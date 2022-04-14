
// fastify
const fastify = require( 'fastify' )( {
  logger: true,
//  trustProxy: true // needed to get ips...
} );

const url = require( 'url' );

// handle posts with formbodys
fastify.register( require( 'fastify-formbody' ) );


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
  if ( !acceptableProtocols.contains( sourceURL.protocol ) || 
       !acceptableProtocols.contains( targetURL.protocol ) ) {
    reply.code( 400 ).send( "Source and target must be HTTP: or HTTPS:" );
    return;
  }
  
  // ...and then should queue and process the request asynchronously, to prevent DoS attacks.
  
  reply
    .code( 202 )
    .send( { sourceURL, targetURL } );
  
} );



fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
} );

