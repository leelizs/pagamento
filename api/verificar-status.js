"use strict";

const https = require("https");
const axios = require("axios");
const fs = require("fs");
const { obterToken } = require("./create-qrcode");

// Caminho do certificado .p12
const certificado = fs.readFileSync("./producao-635811-producao.p12");

// Função para verificar o status do pagamento
async function verificarStatusPagamento(txid) {
  try {
    const token = await obterToken();

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    const configStatus = {
      method: "GET",
      url: `https://pix.api.efipay.com.br/v2/cob/${txid}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
    };

    const statusResponse = await axios(configStatus);
    return statusResponse.data;
  } catch (error) {
    console.error("Erro ao verificar o status do pagamento:", error.message);
    throw error;
  }
}

module.exports = { verificarStatusPagamento };
