import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { ToolMetadata, ToolConfig } from "../../entities/Tool";

export const CryptoToolMetadata: ToolMetadata = {
  id: 'get_crypto_price',
  name: 'Cryptocurrency Prices',
  description: 'Get current cryptocurrency prices from CoinMarketCap',
  category: 'crypto',
  configFields: [
    {
      key: 'apiKey',
      label: 'CoinMarketCap API Key',
      type: 'api_key',
      required: true,
      description: 'Get your API key from coinmarketcap.com',
      placeholder: 'Enter your API key'
    }
  ]
};

export const createCryptoTool = (config: ToolConfig): DynamicStructuredTool => {
  return new DynamicStructuredTool({
    name: "getCryptoPrice",
    description: "Get price of the cryptocurrency from CoinMarketCap.",
    schema: z.object({
      ticker: z.string().describe("Ticker of the cryptocurrency. Such as BTC, ETH, XRP, etc."),
    }),
    func: async ({ ticker }) => {
      const apiKey = config.settings.apiKey;
      if (!apiKey || apiKey === "") {
        return "CoinMarketCap API key is not set. You need to explain user to set it in the config by himself.";
      }
      const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${ticker}`, {
        headers: {
          'X-CMC_PRO_API_KEY': apiKey as string,
        },
      });
      const data = await response.json();
      return `
      ${ticker} : ${data.data[ticker].quote.USD.price}
      `;
    },
  });
};
