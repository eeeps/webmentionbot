
// fastify
import Fastify from 'fastify';
const fastify = Fastify({
  logger: true
});

import fastifyFormbody from 'fastify-formbody';
// handle posts with formbodys
fastify.register( fastifyFormbody );

import url from 'url';
import fetch from 'node-fetch';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;
import li from 'li';



function lookForEndpointsInHeaders( response ) {
  
  const linkHeader = response.headers.get( 'link' ); // returns null if there aren't any
                                                     // concats multiple headers into a comma separated string
  console.log(linkHeader)
  if ( linkHeader ) { 
    const parsedLinks = li.parse( linkHeader, { extended: true } ); // returns an empty array if parsing finds no valid links.
	  const webmentionEndpoints = parsedLinks
		  .filter( l => l.link && l.rel && l.rel.includes( 'webmention' ) )
		  .map( l => l.link );
    return webmentionEndpoints;
  }
  
  return [];

}

async function lookForEndpointsInHTML( response, contentType ) {
  
  const bodyText = await response.text();
  const { document } = ( new JSDOM( bodyText, { contentType: contentType } ) ).window;

  return [ ...document.querySelectorAll( "link[rel='webmention'], a[rel='webmention']" ) ]
    .map( d => d.getAttribute( 'href' ) )
    .filter( d => !!d );
  
}

async function lookForEndpointUsingHeadRequest( toURL, fetchOptions ) {
  
  const fetchOpts = JSON.parse(JSON.stringify( fetchOptions ));
  fetchOpts.method = "HEAD";
  const response = await fetch( toURL.href, fetchOpts );
  const endpoints = lookForEndpointsInHeaders( response );
  if ( endpoints && endpoints[ 0 ] ) {
    return endpoints[ 0 ];
  }
  return null;
  
}

async function lookForEndpointUsingGetRequest( toURL, fetchOptions ) {
  
  // The sender must fetch the target URL (and follow redirects)
  const response = await fetch( toURL.href, fetchOptions );
  
  // Handle non-200 cases informatively
  if (response.status < 200 || response.status > 299) {
    throw response.status ;
  }
  
  // and check for an HTTP Link header [RFC5988] with a rel value of webmention.
  const endpointsInHeaders = lookForEndpointsInHeaders( response );
  if ( endpointsInHeaders && endpointsInHeaders[ 0 ] ) {
    return endpointsInHeaders[ 0 ];
  }
  
  //  If the content type of the document is HTML,
  // then the sender must look for an HTML <link> and <a> element with a rel value of webmention
  const contentType = response.headers.get( 'content-type' );
  if ( contentType && isHTMLish( contentType ) ) {
    const endpointsInHTML = await lookForEndpointsInHTML( response, contentType );
      if ( endpointsInHTML && endpointsInHTML[ 0 ] ) {
      return endpointsInHTML[ 0 ];
    }
  }
    
  return null;
  
}

async function discoverEndpoint( toURL ) {
  
  // 3.1.2 Sender discovers receiver Webmention endpoint
  
  const fetchOptions = {
    headers: {
      'Accept': 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8' // TODO this is browsers' for navigation requests. add json? text?
    },
  	redirect: 'follow',
	  follow: 20
  };
  
  // Senders may initially make an HTTP HEAD request [RFC7231] 
  // to check for the Link header before making a GET request.
  
  console.log('right before endpointFromHeadRequest');
  const endpointFromHeadRequest = await lookForEndpointUsingHeadRequest( toURL, fetchOptions );
  console.log('right after endpointFromHeadRequest',endpointFromHeadRequest );
  if ( endpointFromHeadRequest ) {
     return endpointFromHeadRequest;
  }
  
  // The sender must fetch the target URL... (con't in function)
  console.log('right before endpointFromGetRequest');
  const endpointFromGetRequest = await lookForEndpointUsingGetRequest( toURL, fetchOptions );
  console.log('right after endpointFromGetRequest');
  if ( endpointFromGetRequest  ) {
    return endpointFromGetRequest;
  }
  
  return null;
  
}

// 3.1 Sending Webmentions

fastify.post( '/send', async ( req, reply ) => {
  
  if ( !( req.body.source && req.body.target ) ) {
    reply
      .code( 400 )
      .send( "POST request must contain x-www-form-urlencoded `source` and `target` parameters" );
    return;
  }
  let sourceURL, targetURL;
  try {
    sourceURL = new URL( req.body.source );
    targetURL = new URL( req.body.target );
  } catch {
    reply.code( 400 ).send( "Source and target URLs must be valid URLs." );
    return;
  }
  
  
  console.log('right before discoverEndpoint');
  const endpoint = await discoverEndpoint( targetURL );
  console.log( 'right after discoverEndpoint', endpoint );
  
  reply
    .code( 200 )
    .send( endpoint );
  
} );

// receive posts

fastify.post( '/', ( req, reply ) => {
  
  // 3.2 Receiving Webmentions
  // Upon receipt of a POST request containing the source and target parameters...
  
  if ( !( req.body.source && req.body.target ) ) {
    reply
      .code( 400 )
      .send( "POST request must contain x-www-form-urlencoded `source` and `target` parameters" );
    return;
  }
  
  // ...the receiver should verify the parameters...
  
  // 3.2.1 Request Verification
  // The receiver must check that source and target are valid URLs...
  
  let sourceURL, targetURL;
  try {
    sourceURL = new URL( req.body.source );
    targetURL = new URL( req.body.target );
  } catch {
    reply.code( 400 ).send( "Source and target URLs must be valid URLs." );
    return;
  }
  
  // ...and are of schemes that are supported by the receiver.
  // (Most commonly this means checking that the source and target schemes are http or https).
  
  const acceptableProtocols = [ 'http:', 'https:' ]
  if ( !acceptableProtocols.includes( sourceURL.protocol ) || 
       !acceptableProtocols.includes( targetURL.protocol ) ) {
    reply.code( 400 ).send( "Source and target URLs must use the HTTP or HTTPS protocols." );
    return;
  }
  
  // The receiver must reject the request if the source URL is the same as the target URL.
  if ( sourceURL.href === targetURL.href ) {
    reply.code( 400 ).send( "Specified source and target URLs must not be the same." );
    return;
  }
  
  // The receiver should check that target is a valid resource for which it can accept Webmentions.
  // This check should happen synchronously to reject invalid Webmentions before more in-depth verification begins.
  if ( targetURL.hostname !== 'ericportis.com' ) {
    reply.code( 400 ).send( 'Specified target URL does not accept Webmentions.' );
    return;
  }
  // TODO I shuold probably also check against some list of valid URLs?
  
  // ...and then should queue and process the request asynchronously, to prevent DoS attacks.
  
  reply
    .code( 202 )
    .send( 'Thanks for the webmention! We still need to do some additional verification and moderation; if it passes muster, it\'ll show up on the site.' )
    .then( () => { processValidWebmentionRequest( { sourceURL, targetURL } ) }, () => {} );
  
} );

// 3.2.2 Webmention Verification
// Webmention verification should be handled asynchronously to prevent DoS (Denial of Service) attacks.

async function processValidWebmentionRequest( { sourceURL, targetURL } ) {

  // If the receiver is going to use the Webmention in some way,
  // (displaying it as a comment on a post, incrementing a "like" counter, notifying the author of a post),
  // then it must perform an HTTP GET request on source, 
  // following any HTTP redirects (and should limit the number of redirects it follows)
  // to confirm that it actually mentions the target.
  // The receiver should include an HTTP Accept header indicating its preference of content types that are acceptable.

  console.log( `Asynchronously verifying webmention with source='${ sourceURL.href }' and target='${ targetURL.href }'` )
  
  const response = await fetch( sourceURL.href, {
    headers: {
      'Accept': 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8' // TODO this is browsers' for navigation requests. add json? text?
    },
  	redirect: 'follow',
	  follow: 20
  } );
  
  if ( response.status !== 200 ) {
    console.log( 'Source URL not found.' )
    return;
  }
  
  const bodyText = await response.text();
  
  if ( !mentionsTarget( bodyText, targetURL.href, response.headers.get( 'content-type' ) ) ) {
    console.log( 'Source URL does not contain a link to the target URL.' )
    return;
  }
  console.log('Verified!')  
  console.log('TODO additional parsing? and add mention to db')
}

function mentionsTarget( bodyText, targetURL, contentType ) {
  // spec says you SHOULD do per-content-type processing, lists some examples
  // doing a simple regex instead is universal across content types and quite simple
  // BUT, it matches too many things
  // e.g., target=https://ericportis.com would match a target document containing
  //       <a href="https://ericportis.com/posts/2021/whatever/>blah</a>
  // so I guess we'll do a whole JSDOM thing for HTML, and fallback to regex for other content types... for now
  
  
  if ( isHTMLish( contentType ) ) {
    const { document } = ( new JSDOM( bodyText, { contentType: contentType } ) ).window;
    const anchor = document.querySelector( `a[href='${ targetURL }']` );
    return anchor && anchor.nodeName && anchor.nodeName === 'A';
  }
  
  return ( new RegExp( targetURL ) ).test( bodyText );
  
}

function isHTMLish( contentType ) {
  const htmlishContentTypes = [
    /text\/html/i,
    /application\/xhtml\+xml/i
  ];
  return htmlishContentTypes.reduce( ( acc, cv ) => {
    return acc || cv.test( contentType );
  }, false );
}

fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
} );
