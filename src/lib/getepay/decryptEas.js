import { AES, enc, mode, pad } from "crypto-js";
import Base64 from "crypto-js/enc-base64";

function decryptEas(data, key, iv) {
  const keys = Base64.parse(key);
  const ivs = Base64.parse(iv);
  const ciphertext = enc.Hex.parse(data.toLowerCase());
  const cipherParams = { ciphertext };
  return AES.decrypt(cipherParams, keys, {
    iv: ivs,
    mode: mode.CBC,
    padding: pad.Pkcs7,
  }).toString(enc.Utf8);
}

export default decryptEas;