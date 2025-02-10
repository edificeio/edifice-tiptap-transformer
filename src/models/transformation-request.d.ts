import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export interface ContentTransformerRequest {
  requestedFormats: string[];
  contentVersion: number;
  htmlContent: string;
  jsonContent: any;
  additionalExtensionIds: string[];
}

export interface ContentTransformerResponse {
  contentVersion: number;
  htmlContent: string;
  jsonContent: any;
  plainTextContent: string;
  cleanHtml: string;
  cleanJson: any;
}
