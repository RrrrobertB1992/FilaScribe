// Tags FilaScribe writes, checked against the real readers on the U1
// (paxx12's extended firmware and OpenRFID) by tests/compat/test_readers.py.
import { emptyForm } from '../../src/lib/formats/openspool.js';

const u1 = (over) => ({ ...emptyForm('u1'), ...over });
const standard = (over) => ({ ...emptyForm('standard'), ...over });

export const CASES = [
  {
    name: 'official example',
    form: standard({ type: 'PLA', colors: ['FFAABB'], brand: 'Generic', minTemp: '220', maxTemp: '240' }),
  },
  { name: 'default U1 PLA', form: u1({}) },
  {
    name: 'Snapmaker naming: brand type subtype',
    form: u1({ brand: 'Elegoo', type: 'PETG', subtype: 'Rapid', colors: ['AFAFAF'], minTemp: '230', maxTemp: '260', bedMinTemp: '70', bedMaxTemp: '80' }),
  },
  {
    name: 'custom names',
    form: u1({ brand: 'Fiberlogy', type: 'PLA+', subtype: '95A HF', colors: ['123ABC'] }),
  },
  {
    name: 'three colors as segments',
    form: u1({ brand: 'Polymaker', subtype: 'Silk', colors: ['FF0000', '00FF00', '0000FF'], colorType: '1' }),
  },
  {
    name: 'five colors as a gradient',
    form: u1({ brand: 'Overture', subtype: 'Silk', colors: ['FF0080', '00FF80', '8000FF', 'FFFF00', '00FFFF'], colorType: '0' }),
  },
  {
    name: 'no temperatures or brand',
    form: u1({ brand: '', minTemp: '', maxTemp: '', bedMinTemp: '', bedMaxTemp: '' }),
  },
  {
    name: 'only a bed max temperature',
    form: u1({ bedMinTemp: '', bedMaxTemp: '65' }),
  },
  {
    name: 'spool weight and diameter',
    form: u1({ weight: '750', diameter: '2.85' }),
  },
  {
    name: 'translucent (opacity 80)',
    form: u1({ type: 'PETG', colors: ['33AAFF'], alpha: '80' }),
  },
  {
    name: 'non-ASCII brand',
    form: u1({ brand: 'Filamentwerk München', type: 'ASA', colors: ['202020'] }),
  },
  {
    // Over 255 bytes of JSON: a long NDEF record and the 3-byte TLV length
    name: 'largest tag (long record format)',
    form: u1({
      brand: 'A Very Long Custom Brand Name 1234567890',
      type: 'A-Very-Long-Custom-Material-Name-123456',
      subtype: 'A Very Long Custom Variant Name 12345678',
      colors: ['111111', '222222', '333333', '444444', '555555'],
      colorType: '0',
      minTemp: '500', maxTemp: '500', bedMinTemp: '120', bedMaxTemp: '150',
      alpha: '7F', weight: '5000', diameter: '1.75',
    }),
  },
];
