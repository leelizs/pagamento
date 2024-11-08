"use strict";

const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { obterToken } = require("./create-qrcode");

require("dotenv").config();  // Carregar variáveis de ambiente
const base64 = process.env.PIX_CERTIFICADO_BASE64; // Vercel Secret
const certificadoBuffer = Buffer.from(base64, "base64");
//console.log("Certificado carregado com sucesso", certificadoBuffer.length); // Log para verificar o tamanho do certificado

// Salve o arquivo temporariamente
const tempPath = path.join(__dirname, "certificado_temp.p12");
fs.writeFileSync(tempPath, certificadoBuffer);

// Agora você pode usar `tempPath` para carregar o certificado
const certificado = fs.readFileSync(tempPath);

// Função para verificar o status do pagamento
async function verificarStatusPagamento(txid) {
  try {
    const token = await obterToken();
    alert("Token gerado:", token);

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
