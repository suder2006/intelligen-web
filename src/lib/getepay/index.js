import encryptEas from "./encryptEas";
import decryptEas from "./decryptEas";

const getepayPortal = (data, config) => {
  return new Promise((resolve, reject) => {
    const JsonData = JSON.stringify(data);
    var ciphertext = encryptEas(JsonData, config["GetepayKey"], config["GetepayIV"])
    var newCipher = ciphertext.toUpperCase()
    var myHeaders = new Headers()
    myHeaders.append("Content-Type", "application/json")

    var raw = JSON.stringify({
      mid: data.mid,
      terminalId: data.terminalId,
      req: newCipher,
    })

    fetch(config["GetepayUrl"], {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    })
      .then(response => response.text())
      .then(result => {
        var resultobj = JSON.parse(result)
        var responseurl = resultobj.response
        var dataitem = decryptEas(responseurl, config["GetepayKey"], config["GetepayIV"])
        dataitem = JSON.parse(dataitem)
        resolve(dataitem.paymentUrl)
      })
      .catch(error => reject(error))
  })
}

export default getepayPortal;