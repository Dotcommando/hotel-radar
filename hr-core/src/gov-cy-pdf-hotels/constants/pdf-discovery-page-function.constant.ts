export const PDF_DISCOVERY_PAGE_FUNCTION = `async function pageFunction(context) {
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map((anchor) => anchor.getAttribute('href'))
    .filter((href) => href && href.toLowerCase().includes('.pdf'));

  return {
    url: context.request.url,
    pdfLinks: Array.from(new Set(links)),
  };
}`;
