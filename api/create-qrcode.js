"use strict";

const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

require("dotenv").config();  // Carregar variáveis de ambiente
const base64 = process.env.PIX_CERTIFICADO_BASE64; // Vercel Secret
const certificadoBuffer = Buffer.from(base64, "base64");
//console.log("Certificado carregado com sucesso", certificadoBuffer.length); // Log para verificar o tamanho do certificado

// Salve o arquivo temporariamente
const tempPath = path.join(__dirname, "certificado_temp.p12");
fs.writeFileSync(tempPath, certificadoBuffer);

// Agora você pode usar `tempPath` para carregar o certificado
const certificado = fs.readFileSync(tempPath);

// Credenciais PIX (agora a partir do arquivo .env)
const credenciais = {
  client_id: process.env.CLIENT_ID,  // Usando variáveis de ambiente
  client_secret: process.env.CLIENT_SECRET,  // Usando variáveis de ambiente
};

//console.log("CLIENT_ID:", process.env.CLIENT_ID);
//console.log("CLIENT_SECRET:", process.env.CLIENT_SECRET);

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
    //console.log("Token recebido:", tokenResponse.data);
    if (tokenResponse.status !== 200) {
      console.error("Erro ao obter token:", tokenResponse.status, tokenResponse.data);
      throw new Error("Erro ao obter token");
    }
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error("Erro ao obter token:", error.response ? error.response.data : error.message);
    throw error;
  }
}

//console.log(credenciais);

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
    //console.log(qrcodeResponse.data); // Adicionando log da resposta
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
