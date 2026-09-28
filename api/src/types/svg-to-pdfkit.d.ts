declare module "svg-to-pdfkit" {
  type SvgToPdfOptions = {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
  };

  const SVGtoPDF: (
    document: PDFKit.PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: SvgToPdfOptions,
  ) => void;

  export default SVGtoPDF;
}
