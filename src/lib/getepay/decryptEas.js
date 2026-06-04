import { AES, enc, format, mode, pad } from "crypto-js";
import Base64 from "crypto-js/enc-base64";

function decryptEas(data, key, iv) {
  const keys = Base64.parse(key);
  const ivs = Base64.parse(iv);
  return AES.decrypt(data, keys, {
    iv: ivs,
    mode: mode.CBC,
    padding: pad.Pkcs7,
    format: format.Hex,
  }).toString(enc.Utf8);
}

export default decryptEas;