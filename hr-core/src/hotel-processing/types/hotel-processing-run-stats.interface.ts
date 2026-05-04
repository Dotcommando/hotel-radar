export interface IHotelProcessingRunStats {
  total: number;
  processed: number;
  failed: number;
  ignored: number;
  reviewRequired?: number;
}
