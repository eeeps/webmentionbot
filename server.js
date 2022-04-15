
// fastify
import Fastify from 'fastify'
const fastify = Fastify({
  logger: true
})

import fastifyFormbody from 'fastify-formbody';
// handle posts with formbodys
fastify.register( fastifyFormbody );

import url from 'url';


// receive posts

fastify.post( '/', ( req, reply ) => {
  
  // 3.2 Receiving Webmentions
  // Upon receipt of a POST request containing the source and target parameters...
  
  if ( !( req.body.source && req.body.target ) ) {
    reply
      .code( 400 )
      .send( "POST request must contain x-www-form-urlencoded source and target parameters" );
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
    reply.code( 400 ).send( "source and target must be valid URLs" );
    return;
  }
  
  // ...and are of schemes that are supported by the receiver.
  // (Most commonly this means checking that the source and target schemes are http or https).
  
  const acceptableProtocols = [ 'http:', 'https:' ]
  if ( !acceptableProtocols.includes( sourceURL.protocol ) || 
       !acceptableProtocols.includes( targetURL.protocol ) ) {
    reply.code( 400 ).send( "Source and target must be HTTP: or HTTPS:" );
    return;
  }
  
  // The receiver must reject the request if the source URL is the same as the target URL.
  if ( sourceURL.href === targetURL.href ) {
    reply.code( 400 ).send( "source and target must not be the same" );
    return;
  }
  
  // The receiver should check that target is a valid resource for which it can accept Webmentions.
  // This check should happen synchronously to reject invalid Webmentions before more in-depth verification begins.
  if ( targetURL.hostname !== 'ericportis.com' ) {
    reply.code( 400 ).send( "target must be on ericportis.com" );
    return;
  }
  
  // TODO other checks?
  
  // ...and then should queue and process the request asynchronously, to prevent DoS attacks.
  
  reply
    .code( 202 )
    .send( { sourceURL, targetURL } )
    .then( () => { processValidWebmentionRequest( { sourceURL, targetURL } )}, () => {} );
  
} );

// 3.2.2 Webmention Verification
// Webmention verification should be handled asynchronously to prevent DoS (Denial of Service) attacks.

async function processValidWebmentionRequest( { sourceURL, targetURL } ) {

  // If the receiver is going to use the Webmention in some way,
  // (displaying it as a comment on a post, incrementing a "like" counter, notifying the author of a post),
  // then it must perform an HTTP GET request on source, 
  // following any HTTP redirects (and should limit the number of redirects it follows)
  // to confirm that it actually mentions the target.
  
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;
  const fetch = await import('node-fetch');
  
  const response = await fetch(sourceURL.href);
  const dom = new JSDOM(response.body);
  console.log( dom.querySelector(`a[href=${targetURL.href}]`) )
  
  // The receiver should include an HTTP Accept header indicating its preference of content types that are acceptable.
  
  
  setTimeout(function () {
    console.log( sourceURL.href, targetURL.href );
  }, 5000);
}


fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
} );

