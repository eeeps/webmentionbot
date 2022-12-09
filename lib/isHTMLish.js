export function isHTMLish( contentType ) {
  const htmlishContentTypes = [
    /text\/html/i,
    /application\/xhtml\+xml/i
  ];
  return htmlishContentTypes.reduce( ( acc, cv ) => {
    return acc || cv.test( contentType );
  }, false );
}
