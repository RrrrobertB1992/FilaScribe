package io.github.rrrrobertb1992.filascribe;

import android.app.Activity;
import android.content.Intent;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.TagLostException;
import android.nfc.tech.MifareUltralight;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;

/**
 * NFC for FilaScribe, using Android reader mode so the app gets the tag
 * directly while a read or write is waiting.
 *
 *  read()                         -> { uid, chip, techs, maxNdefSize, writable, ndef?, pages? }
 *  writeNdef({ message, expectedUid? }) -> same, with ndef read back after writing
 *  isAvailable()                  -> { available, enabled }
 *  cancel(), openSettings()
 *  event "wrongTag" { uid }: a write with expectedUid saw another tag (keeps waiting)
 *
 * Byte values (ndef, pages, message) are base64. Errors reject with a code:
 * NO_NFC, NFC_DISABLED, CANCELLED, TAG_LOST, WRONG_TAG, READ_ONLY, TOO_BIG,
 * NOT_NDEF, BAD_MESSAGE, FAILED.
 */
@CapacitorPlugin(name = "FilaScribeNfc")
public class FilaScribeNfcPlugin extends Plugin {

    private static final int READER_FLAGS = NfcAdapter.FLAG_READER_NFC_A
            | NfcAdapter.FLAG_READER_NFC_B
            | NfcAdapter.FLAG_READER_NFC_F
            | NfcAdapter.FLAG_READER_NFC_V;

    private final Object lock = new Object();
    private PluginCall pending;
    private boolean writing;
    private byte[] writeMessage;
    private String expectedUid;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter adapter = adapter();
        JSObject result = new JSObject();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void read(PluginCall call) {
        start(call, false, null, null);
    }

    @PluginMethod
    public void writeNdef(PluginCall call) {
        String b64 = call.getString("message", "");
        byte[] message;
        try {
            message = Base64.decode(b64, Base64.DEFAULT);
            new NdefMessage(message); // check it parses before waiting for a tag
        } catch (IllegalArgumentException | FormatException e) {
            call.reject("The message to write isn't a valid NDEF message.", "BAD_MESSAGE");
            return;
        }
        start(call, true, message, call.getString("expectedUid", ""));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        PluginCall old;
        synchronized (lock) {
            old = pending;
            pending = null;
        }
        stopReaderMode();
        if (old != null) old.reject("Cancelled.", "CANCELLED");
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NFC_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    // --- Session ---

    private NfcAdapter adapter() {
        return NfcAdapter.getDefaultAdapter(getContext());
    }

    private void start(PluginCall call, boolean write, byte[] message, String uid) {
        NfcAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("This phone doesn't have NFC.", "NO_NFC");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC is turned off.", "NFC_DISABLED");
            return;
        }
        PluginCall old;
        synchronized (lock) {
            old = pending;
            pending = call;
            writing = write;
            writeMessage = message;
            expectedUid = uid == null ? "" : uid.toUpperCase(Locale.US);
        }
        if (old != null) old.reject("Replaced by a newer NFC request.", "CANCELLED");
        startReaderMode();
    }

    private void startReaderMode() {
        final Activity activity = getActivity();
        final NfcAdapter adapter = adapter();
        if (activity == null || adapter == null) return;
        activity.runOnUiThread(() -> {
            Bundle extras = new Bundle();
            extras.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250);
            adapter.enableReaderMode(activity, this::onTag, READER_FLAGS, extras);
        });
    }

    private void stopReaderMode() {
        final Activity activity = getActivity();
        final NfcAdapter adapter = adapter();
        if (activity == null || adapter == null) return;
        activity.runOnUiThread(() -> {
            try {
                adapter.disableReaderMode(activity);
            } catch (IllegalStateException ignored) {
                // Activity not resumed; reader mode is already off
            }
        });
    }

    // Android turns reader mode off while the app is in the background, so
    // turn it back on when the app returns with a request still waiting.
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        boolean active;
        synchronized (lock) {
            active = pending != null;
        }
        if (active) startReaderMode();
    }

    // --- Tag handling (runs on an NFC binder thread) ---

    private void onTag(Tag tag) {
        PluginCall call;
        boolean write;
        byte[] message;
        String wantUid;
        synchronized (lock) {
            call = pending;
            write = writing;
            message = writeMessage;
            wantUid = expectedUid;
        }
        if (call == null) return;

        try {
            String uid = hex(tag.getId());
            if (write && !wantUid.isEmpty() && !wantUid.equals(uid)) {
                // Keep waiting: the right tag may come next
                notifyListeners("wrongTag", new JSObject().put("uid", uid));
                return;
            }

            JSObject result = new JSObject();
            result.put("uid", uid);
            JSArray techs = new JSArray();
            for (String t : tag.getTechList()) techs.put(t.substring(t.lastIndexOf('.') + 1));
            result.put("techs", techs);

            String chip = detectChip(tag);
            if (chip != null) result.put("chip", chip);

            if (write) writeMessage(tag, message);

            readNdef(tag, result);
            if (!write) {
                byte[] pages = readPages(tag, chip);
                if (pages != null) result.put("pages", Base64.encodeToString(pages, Base64.NO_WRAP));
            }
            finish(call, result, null, null);
        } catch (TagLostException e) {
            finish(call, null, "The tag moved away before it finished. Hold it still against the phone and try again.", "TAG_LOST");
        } catch (NfcFailure e) {
            finish(call, null, e.getMessage(), e.code);
        } catch (IOException | RuntimeException e) {
            finish(call, null, "NFC error: " + e.getMessage(), "FAILED");
        }
    }

    private void finish(PluginCall call, JSObject result, String error, String code) {
        synchronized (lock) {
            if (pending != call) return; // cancelled meanwhile
            pending = null;
            writeMessage = null;
        }
        stopReaderMode();
        if (error != null) call.reject(error, code);
        else call.resolve(result);
    }

    private static final class NfcFailure extends Exception {
        final String code;

        NfcFailure(String message, String code) {
            super(message);
            this.code = code;
        }
    }

    /** NTAG213/215/216 from GET_VERSION, or null for other tags. */
    private String detectChip(Tag tag) {
        MifareUltralight mu = MifareUltralight.get(tag);
        if (mu == null) return null;
        try {
            mu.connect();
            byte[] v = mu.transceive(new byte[]{0x60});
            // 00 vendor(04=NXP) type(04=NTAG) subtype major minor storage protocol
            if (v != null && v.length >= 8 && v[1] == 0x04 && v[2] == 0x04) {
                switch (v[6]) {
                    case 0x0F: return "NTAG213";
                    case 0x11: return "NTAG215";
                    case 0x13: return "NTAG216";
                    default: return "NTAG";
                }
            }
            return mu.getType() == MifareUltralight.TYPE_ULTRALIGHT_C ? "MIFARE Ultralight C" : "MIFARE Ultralight";
        } catch (IOException e) {
            return null; // GET_VERSION not supported
        } finally {
            closeQuietly(mu);
        }
    }

    private static int pageCount(String chip) {
        if ("NTAG213".equals(chip)) return 45;
        if ("NTAG215".equals(chip)) return 135;
        if ("NTAG216".equals(chip)) return 231;
        return 0;
    }

    /** Every page of an NTAG21x, 4 bytes each, for the raw view. */
    private byte[] readPages(Tag tag, String chip) throws IOException {
        int count = pageCount(chip);
        MifareUltralight mu = MifareUltralight.get(tag);
        if (count == 0 || mu == null) return null;
        try {
            mu.connect();
            ByteArrayOutputStream out = new ByteArrayOutputStream(count * 4);
            for (int page = 0; page < count; page += 4) {
                byte[] block = mu.readPages(page); // 4 pages, wraps at the end
                int take = Math.min(4, count - page) * 4;
                out.write(block, 0, take);
            }
            return out.toByteArray();
        } catch (TagLostException e) {
            throw e;
        } catch (IOException e) {
            return null; // some pages are protected; the dump is optional
        } finally {
            closeQuietly(mu);
        }
    }

    private void readNdef(Tag tag, JSObject result) throws IOException {
        Ndef ndef = Ndef.get(tag);
        if (ndef == null) {
            result.put("writable", NdefFormatable.get(tag) != null);
            return;
        }
        try {
            ndef.connect();
            result.put("maxNdefSize", ndef.getMaxSize());
            result.put("writable", ndef.isWritable());
            NdefMessage msg = ndef.getNdefMessage(); // null on an empty tag
            if (msg != null) result.put("ndef", Base64.encodeToString(msg.toByteArray(), Base64.NO_WRAP));
        } catch (FormatException e) {
            // Not a valid NDEF message: report the tag without one
        } finally {
            closeQuietly(ndef);
        }
    }

    private void writeMessage(Tag tag, byte[] bytes) throws IOException, NfcFailure {
        NdefMessage message;
        try {
            message = new NdefMessage(bytes);
        } catch (FormatException e) {
            throw new NfcFailure("The message to write isn't a valid NDEF message.", "BAD_MESSAGE");
        }
        Ndef ndef = Ndef.get(tag);
        if (ndef != null) {
            try {
                ndef.connect();
                if (!ndef.isWritable()) throw new NfcFailure("This tag is locked (read-only).", "READ_ONLY");
                if (bytes.length > ndef.getMaxSize()) {
                    throw new NfcFailure("The data (" + bytes.length + " bytes) doesn't fit on this tag ("
                            + ndef.getMaxSize() + " bytes).", "TOO_BIG");
                }
                ndef.writeNdefMessage(message);
            } catch (FormatException e) {
                throw new NfcFailure("The tag rejected the data.", "FAILED");
            } finally {
                closeQuietly(ndef);
            }
            return;
        }
        NdefFormatable formatable = NdefFormatable.get(tag);
        if (formatable == null) throw new NfcFailure("This tag can't hold NDEF data.", "NOT_NDEF");
        try {
            formatable.connect();
            formatable.format(message);
        } catch (FormatException e) {
            throw new NfcFailure("The tag couldn't be formatted for NDEF.", "FAILED");
        } finally {
            closeQuietly(formatable);
        }
    }

    // --- Helpers ---

    private static void closeQuietly(android.nfc.tech.TagTechnology t) {
        try {
            t.close();
        } catch (IOException ignored) {
        }
    }

    private static String hex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02X", b));
        return sb.toString();
    }
}
