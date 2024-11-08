const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

require("dotenv").config();  // Carregar variáveis de ambiente
const base64 = process.env.PIX_CERTIFICADO_BASE64; // Vercel Secret
const certificadoBuffer = Buffer.from(base64, "base64");

// Salve o arquivo temporariamente (em uma função serverless, isso não é recomendado, você pode querer usar o fs temporário)
const tempPath = path.join(__dirname, "certificado_temp.p12");
fs.writeFileSync(tempPath, certificadoBuffer);

// Agora você pode usar `tempPath` para carregar o certificado
const certificado = fs.readFileSync(tempPath);

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
    if (tokenResponse.status !== 200) {
      throw new Error("Erro ao obter token");
    }
    return tokenResponse.data.access_token;
  } catch (error) {
    throw new Error("Erro ao obter token");
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
    throw new Error("Erro ao gerar QR Code");
  }
}

// Função serverless para Vercel
module.exports = async (req, res) => {
  if (req.method === "POST") {
    try {
      const { valor } = req.body;
      const valorFormatado = parseFloat(valor).toFixed(2);

      const qrcodeData = await gerarQRCode(valorFormatado);

      res.status(200).json({
        qrcode: {
          imagemQrcode: qrcodeData.copiaECola,
          txid: qrcodeData.txid,
          copiaECola: qrcodeData.copiaECola,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao gerar QR Code" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
};
