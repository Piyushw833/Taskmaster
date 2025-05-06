import { Request, Response } from 'express';
import { askOpenAI } from '../services/openai.service';

export const aiValuation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { property } = req.body;
    if (!property) {
      res.status(400).json({ error: 'Missing property data' });
      return;
    }
    const prompt = `You are a real estate valuation expert. Given the following property details, provide a detailed valuation and reasoning.\nProperty: ${JSON.stringify(property, null, 2)}`;
    const result = await askOpenAI(prompt);
    res.status(200).json({ valuation: result });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message || 'AI valuation failed' });
  }
};

export const aiDocumentParse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentText } = req.body;
    if (!documentText) {
      res.status(400).json({ error: 'Missing document text' });
      return;
    }
    const prompt = `You are a contract analysis AI. Parse the following contract/document and extract key clauses, obligations, and risks. Present the output as structured JSON.\nDocument: ${documentText}`;
    const result = await askOpenAI(prompt);
    res.status(200).json({ parsed: result });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message || 'AI document parsing failed' });
  }
};

export const aiRoiCalculator = async (req: Request, res: Response): Promise<void> => {
  try {
    const { investment } = req.body;
    if (!investment) {
      res.status(400).json({ error: 'Missing investment parameters' });
      return;
    }
    const prompt = `You are an investment analyst AI. Given the following real estate investment parameters, calculate the expected ROI and provide a detailed breakdown.\nInvestment: ${JSON.stringify(investment, null, 2)}`;
    const result = await askOpenAI(prompt);
    res.status(200).json({ roi: result });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message || 'AI ROI calculation failed' });
  }
}; 