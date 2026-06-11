import { AES, enc, mode, pad } from "crypto-js";
import Base64 from "crypto-js/enc-base64";

function encryptEas(data, key, iv) {
  const keys = Base64.parse(key);
  const ivs = Base64.parse(iv);
  const encrypted = AES.encrypt(data, keys, {
    iv: ivs,
    mode: mode.CBC,
    padding: pad.Pkcs7,
  });
  return encrypted.ciphertext.toString(enc.Hex);
}

export default encryptEas;