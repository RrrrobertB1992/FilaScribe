package io.github.rrrrobertb1992.filascribe;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins are registered before the bridge starts
        registerPlugin(FilaScribeNfcPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
