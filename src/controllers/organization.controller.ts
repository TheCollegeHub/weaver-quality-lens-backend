import { Request, Response } from 'express';
import { getAllAreaPaths } from '../services/azure-organization.service';
import { AzureApiError, AzureErrorHandler, ErrorResponse } from '../utils/azure-error-handler';

export const getAreaPaths = async (req: Request, res: Response) => {
  try {
    const areas = await getAllAreaPaths();
    return res.json(areas);
  } catch (err: any) {
    console.error('Error in getAreaPaths:', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack
    });

    // Handle known Azure API errors
    if (err instanceof AzureApiError) {
      const errorResponse = AzureErrorHandler.createErrorResponse(err);
      return res.status(err.statusCode).json(errorResponse);
    }

    // Handle generic errors
    const unknownError = AzureErrorHandler.handleUnknownError(err, 'getAreaPaths');
    const errorResponse = AzureErrorHandler.createErrorResponse(unknownError);
    return res.status(unknownError.statusCode).json(errorResponse);
  }
};