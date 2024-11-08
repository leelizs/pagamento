"use strict";

const https = require("https");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();  // Carregar variáveis de ambiente

// Caminho do certificado .p12
const certificado = fs.readFileSync("./producao-635811-producao.p12");

// Credenciais PIX (agora a partir do arquivo .env)
const credenciais = {
  client_id: process.env.CLIENT_ID,  // Usando variáveis de ambiente
  client_secret: process.env.CLIENT_SECRET,  // Usando variáveis de ambiente
};

// Função para obter o token de acesso
async function obterToken() {
  try {
    const data_credentials = `${credenciais.client_id}:${credenciais.client_secret}`;
    const auth = Buffer.from(data_credentials).toString("base64");

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    const configToken = {
      method: "POST",
      url: "https://pix.api.efipay.com.br/oauth/token",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: { grant_type: "client_credentials" },
    };

    const tokenResponse = await axios(configToken);
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error("Erro ao obter token:", error.response ? error.response.data : error.message);
    throw error;
  }
}

// Função para gerar o QR Code
async function gerarQRCode(valor) {
  try {
    const token = await obterToken();

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    const qrcodeConfig = {
      method: "POST",
      url: "https://pix.api.efipay.com.br/v2/cob",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: {
        calendario: { expiracao: 600 },
        valor: { original: valor },
        chave: "0a2814e9-73ac-4e23-894e-c40ff3f8e0e9",
        solicitacaoPagador: "Pagamento do QR Code",
      },
    };

    const qrcodeResponse = await axios(qrcodeConfig);
    return {
      qrcodeData: qrcodeResponse.data,
      txid: qrcodeResponse.data.txid,
      copiaECola: qrcodeResponse.data.pixCopiaECola,
    };
  } catch (error) {
    console.error("Erro ao gerar QR Code:", error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { obterToken, gerarQRCode };
