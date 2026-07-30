import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for Gemini client
  const getGeminiClient = () => {
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API Routes for Gemini AI Intelligence

  // 1. Generate Product Marketing Description & Pricing Advice
  app.post("/api/gemini/generate-product-info", async (req, res) => {
    try {
      const { nomeProduto, materiais, custoMaterial, margemLucro, precoSugerido } = req.body;
      const ai = getGeminiClient();

      const prompt = `Você é um especialista em marketing, artesanato e precificação para ateliês de personalizados ("MM Personalizados").
Produto: "${nomeProduto || "Produto Personalizado"}"
Materiais Utilizados: ${materiais && materiais.length > 0 ? JSON.stringify(materiais) : "Não especificado"}
Custo Total dos Materiais: R$ ${custoMaterial || 0}
Margem de Lucro: ${margemLucro || 100}%
Preço Final Calculado: R$ ${precoSugerido || 0}

Gere uma resposta em JSON contendo:
- "descricao": Uma legenda/descrição encantadora para redes sociais (Instagram/WhatsApp) enfatizando o carinho e acabamento artesanal feito à mão.
- "dicasPrecificacao": Dicas valiosas e curtas de precificação para este item (ex: tempo de confecção, sugestão de kit, margem de segurança).
- "tags": Array com 5 a 8 hashtags estratégicas em português (ex: ["#ateliemmpersonalizados", "#papelariapersonalizada", ...]).
- "tempoProducaoEstimado": Estimativa de tempo de confecção.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              descricao: { type: Type.STRING },
              dicasPrecificacao: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              tempoProducaoEstimado: { type: Type.STRING },
            },
            required: ["descricao", "dicasPrecificacao", "tags"],
          },
        },
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("Gemini product info error:", error);
      res.status(500).json({ error: error.message || "Erro ao gerar informações do produto" });
    }
  });

  // 2. Generate WhatsApp Customer Message
  app.post("/api/gemini/generate-whatsapp-msg", async (req, res) => {
    try {
      const { cliente, numero, dataEntrega, status, valorTotal, itens } = req.body;
      const ai = getGeminiClient();

      const itensTexto = itens && Array.isArray(itens)
        ? itens.map((i: any) => `${i.quantidade}x ${i.produtoNome}`).join(", ")
        : "Seus produtos personalizados";

      const prompt = `Você é a atendente do ateliê MM Personalizados.
Crie uma mensagem muito carinhosa, profissional e educada para enviar no WhatsApp do cliente.

Dados:
- Cliente: ${cliente}
- Pedido: ${numero}
- Status: ${status === "em_aberto" ? "Em produção / confirmado em aberto" : "Concluído / Pronto para entrega"}
- Data Prevista de Entrega/Retirada: ${dataEntrega || "A combinar"}
- Valor Total: R$ ${valorTotal}
- Itens do Pedido: ${itensTexto}

Requisitos:
- Use emojis delicados e fofos adequados a um ateliê de arte e festas.
- Seja cortês, transparente e atenciosa.
- Retorne APENAS o texto da mensagem formatada para WhatsApp.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      res.json({ mensagem: response.text });
    } catch (error: any) {
      console.error("Gemini whatsapp msg error:", error);
      res.status(500).json({ error: error.message || "Erro ao gerar mensagem de WhatsApp" });
    }
  });

  // 3. Atelier AI Assistant Chat
  app.post("/api/gemini/assistant", async (req, res) => {
    try {
      const { mensagem } = req.body;
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: mensagem,
        config: {
          systemInstruction: `Você é a Assistente Virtual IA do ateliê MM Personalizados.
Seu papel é auxiliar a artesã/proprietária em tarefas do dia a dia do ateliê, como:
- Ideias criativas para temas de festas, aniversários e lembrancinhas.
- Dicas de combinação de papéis, vinis e materiais de artesanato.
- Estratégias para precificação correta e como calcular valor de hora trabalhada.
- Como lidar com prazos, clientes indecisos e divulgação nas redes sociais.

Responda sempre com simpatia, clareza, em português do Brasil e usando tópicos organizados.`,
        },
      });

      res.json({ resposta: response.text });
    } catch (error: any) {
      console.error("Gemini assistant error:", error);
      res.status(500).json({ error: error.message || "Erro no assistente de IA" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
