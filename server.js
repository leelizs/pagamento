"use strict";

const https = require("https");
const axios = require("axios");
const fs = require("fs");
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Caminho do certificado .p12
const certificado = fs.readFileSync("./producao-635811-producao.p12");

// Credenciais PIX
const credenciais = {
  client_id: "Client_Id_6d8d38dac2252bc78e192b4b4cc7e174be167274",
  client_secret: "Client_Secret_d69736d724d11afc37d3a542caa2fd2d24536f31",
};

// Variável temporária para armazenar informações do QR Code atual
let qrCodeAtual = null;
let expiracaoTimestamp = null;

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
    const qrcodeData = qrcodeResponse.data; // Dados da resposta

    //console.log("Dados recebidos:", qrcodeData);

    // Verificação das propriedades na resposta
    if (!qrcodeData || !qrcodeData.txid || !qrcodeData.location || !qrcodeData.pixCopiaECola) {
      console.error("Resposta da API PIX incompleta:", qrcodeData);
      res.status(500).json({ error: "Dados incompletos na resposta da API PIX." });
      return;
    }

    return {
      qrcodeData: qrcodeData,
      txid: qrcodeData.txid,              // Adicionando o txid
      copiaECola: qrcodeData.pixCopiaECola, // Adicionando o código Copia e Cola
    };

  } catch (error) {
    // Logando erro na geração do QR Code
    console.error("Erro ao gerar QR Code:", error.response ? error.response.data : error.message);
    throw error;
  }
}

// Rota para criar o QR Code

app.post("/create-qrcode", async (req, res) => {
  try {
    const { valor } = req.body;
    const valorFormatado = parseFloat(valor).toFixed(2);

    // Gerando o QR Code
    const qrcodeData = await gerarQRCode(valorFormatado);

    if (!qrcodeData) {
      res.status(500).json({ error: "Erro ao gerar QR Code." });
      return;
    }

    // Respondendo com os dados do QR Code
    res.json({
      qrcode: {
        imagemQrcode: qrcodeData.copiaECola,  // Acessando diretamente o código Copia e Cola
        txid: qrcodeData.txid,             // Acessando txid diretamente
        copiaECola: qrcodeData.copiaECola, // Acessando copiaECola diretamente
      },
    });

  } catch (error) {
    // Verificando se há resposta da API com erro
    if (error.response && error.response.data && error.response.data.error) {
      // Logando erro detalhado da API
      console.error("Erro na API PIX:", error.response.data.error);
      res.status(500).json({ error: `Erro ao gerar QR Code (API): ${error.response.data.error}` });
    } else if (error.response) {
      // Caso a API retorne algo, mas sem o campo de erro específico
      console.error("Resposta da API PIX:", error.response.data);
      res.status(500).json({ error: "Erro inesperado ao gerar QR Code (problema com a API do PIX)." });
    } else if (error.request) {
      // Caso o erro seja relacionado à requisição (rede, timeout, etc)
      console.error("Erro na requisição:", error.request);
      res.status(500).json({ error: "Erro na requisição à API do PIX (problema de rede)." });
    } else {
      // Para erros inesperados
      console.error("Erro inesperado:", error.stack);
      res.status(500).json({ error: `Erro inesperado ao gerar QR Code: ${error.message}` });
    }
  }
});

// Função para verificar o status do pagamento
async function verificarStatusPagamento(txid) {
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

  try {
    const statusResponse = await axios(configStatus);
    return statusResponse.data;
  } catch (error) {
    console.error("Erro ao verificar o status do pagamento:", error.message);
    throw error;
  }
}

// Rota para consultar o status do pagamento
app.get("/verificar-status/:txid", async (req, res) => {
  try {
    const { txid } = req.params;
    const statusData = await verificarStatusPagamento(txid);
    res.json(statusData);
  } catch (error) {
    res.status(500).json({ error: "Erro ao verificar status de pagamento" });
  }
});

// Rota para cancelar QR Code
app.post("/cancelar-qrcode", (req, res) => {
  qrCodeAtual = null;
  expiracaoTimestamp = null;
  res.json({ status: "QR Code cancelado" });
});

// Inicializar o servidor
app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
