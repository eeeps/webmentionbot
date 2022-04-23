
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

import pg from 'pg';
const { Client } = pg;



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
  console.log('Verified! Storing webmention...')  
  
  await storeMention( sourceURL.href, targetURL.href );
  // await getMentions();
  
}

// endpoint to get mentions

fastify.get( '/', async ( req, reply ) => {
  const query = req.query;
  if ( !query.target ) {
    reply.code( 400 ).send( 'GET requests must come with a target query parameter.' );
    return;
  }
  const response = await getMentions( query.target );
  reply.send( response );
} );

function dbClient() {
  const dbConfig = {
    connectionString: process.env.DATABASE_URL
  };
  if ( !( /^postgresql\:\/\/localhost/.test( process.env.DATABASE_URL ) ) ) {
    // no ssl locally
    dbConfig.ssl = { rejectUnauthorized: false };
  }
  return( new Client( dbConfig ) );
}

async function getMentions( target ) {
  const client = dbClient();
  client.connect();
  const text = 'SELECT * FROM mentions WHERE target = $1';
  const values = [ target ];
  const res = await client.query( text, values );
  return res.rows;
}

async function storeMention( source, target ) {

  const client = dbClient();
  client.connect();

  const text = `
INSERT INTO mentions (source, target)
VALUES ($1, $2) 
ON CONFLICT ON CONSTRAINT unique_pairs
DO 
   UPDATE SET modified = CURRENT_TIMESTAMP
RETURNING *;
`;
  const values = [ source, target ];
  
  try {
    const res = await client.query( text, values );
    console.log( res.rows[ 0 ] );
  } catch ( err ) {
    console.log( err.stack );
  }

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

fastify.listen( process.env.PORT, '0.0.0.0', function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
} );
