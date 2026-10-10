declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
  }
  function pdf(dataBuffer: Buffer): Promise<PDFData>;
  export default pdf;
}
