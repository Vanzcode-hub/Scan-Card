import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BillData {
  kWh: number;
  kVARh_lag: number;
  kVARh_lead: number;
  kVAh: number;
  meter_pf?: number;
  calculated_pf: number;
  billing_period?: string;
  load_type: 'lagging' | 'leading' | 'unity';
  explanation: string;
  // Account & Billing Info
  customer_name?: string;
  customer_address?: string;
  customer_mobile?: string;
  customer_email?: string;
  activity?: string; // Purpose of supply/Tariff Category
  bill_amount?: number;
  demand_charges?: number; // Fixed/Maximum demand charges
  tariff_rate?: number; // Rs./kVAh
  sanctioned_demand_kva?: number;
  sanctioned_load_kw?: number;
  // Demand Specifics - Streamlined
  billing_demand_kva?: number;
  min_demand_kva?: number;
  // Analysis Metadata
  analysis_method: 'Standard Trigonometric Calculation' | 'AI Reactive Imbalance Analysis';
  recommended_kvar_rating: number;
}

export async function analyzeBill(base64Data: string, mimeType: string): Promise<BillData> {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: `Analyze this electricity bill as the ElectraPF Pulse Intelligence Layer. This data will be used to generate a structured Quotation.
          
          EXTRACTION TASKS:
          1. ACCOUNT INFO: 
             - Customer Name: [Account Holder Name]
             - Address: [Full site address from the bill]
             - Mobile Number: [Extract if present, otherwise null]
             - Email: [Extract if present, otherwise null]
             - Bill Amount: [Total Payable for the current month]
          2. DEMAND CHARGES: Locate the specific "Fixed Charges", "Demand Charges", or "Maximum Demand Charges" listed in the billing breakdown.
          3. ACTIVITY: Locate the "Activity", "Tariff Category", or "Purpose of Supply" (e.g., "Industrial-HT", "Commercial", "Residential").
          4. TARIFF RATE: Although we will calculate this, extract "Rs./kVAh" if explicitly mentioned.
          5. DEMAND ANALYSIS: 
             - Contract/Sanctioned Demand (in kVA).
             - Sanctioned Load (in kW).
             - Billing Demand / Actual Chargeable Demand (Extract this as 'billing_demand_kva').
             - Minimum Demand Value: Extract the specific Minimum Demand value in kVA ('min_demand_kva').
          5. ENERGY DATA: Extract kWh (Active Energy), kVARh Lag (Inductive), kVARh Lead (Capacitive), and kVAh (Apparent Energy).
          6. METER PF: Extract any explicitly printed Power Factor ('meter_pf').
          
          ANALYSIS LOGIC (DUAL-PATH):
          7. REACTIVE IDENTIFICATION: Identify if the state is Lagging (Lag > Lead) or Leading (Lead > Lag). Sets 'load_type'.
          8. PATH DETERMINATION:
             - PATH 1 (Lagging): Set 'analysis_method' to "Standard Trigonometric Calculation". 
               The 'recommended_kvar_rating' should be 0 (will be calculated by the UI using trig).
             - PATH 2 (Leading): Set 'analysis_method' to "AI Reactive Imbalance Analysis".
               Analyze the ratio of Lead Reactive units to Active Energy. Determine the peak reactive surge that needs to be "neutralized". 
               Infer a 'recommended_kvar_rating' for an Automatic APFC Panel size that can dynamically manage this specific capacitive load profile.
          
          CALCULATION & LOGIC:
          9. MANDATORY CALCULATION: Independently calculate the Power Factor using the formula: PF = kWh / kVAh. 
          
          EXPLANATION (Field Insight):
          Provide a detailed explanation. If Leading, evaluate the "Over-compensation" currently occurring.
          Mention explicitly in the explanation which logic path was used.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          kWh: { type: Type.NUMBER },
          kVARh_lag: { type: Type.NUMBER },
          kVARh_lead: { type: Type.NUMBER },
          kVAh: { type: Type.NUMBER },
          meter_pf: { type: Type.NUMBER },
          calculated_pf: { type: Type.NUMBER },
          billing_period: { type: Type.STRING },
          load_type: { 
            type: Type.STRING,
            enum: ['lagging', 'leading', 'unity']
          },
          explanation: { type: Type.STRING },
          customer_name: { type: Type.STRING },
          customer_address: { type: Type.STRING },
          customer_mobile: { type: Type.STRING },
          customer_email: { type: Type.STRING },
          activity: { type: Type.STRING },
          bill_amount: { type: Type.NUMBER },
          demand_charges: { type: Type.NUMBER },
          tariff_rate: { type: Type.NUMBER },
          sanctioned_demand_kva: { type: Type.NUMBER },
          sanctioned_load_kw: { type: Type.NUMBER },
          billing_demand_kva: { type: Type.NUMBER },
          min_demand_kva: { type: Type.NUMBER },
          analysis_method: { 
            type: Type.STRING,
            enum: ['Standard Trigonometric Calculation', 'AI Reactive Imbalance Analysis']
          },
          recommended_kvar_rating: { type: Type.NUMBER },
        },
        required: ["kWh", "kVAh", "calculated_pf", "load_type", "explanation", "analysis_method", "recommended_kvar_rating"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to analyze bill. No data returned.");
  }

  return JSON.parse(response.text);
}
