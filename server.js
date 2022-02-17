// Require the framework and instantiate it

// CommonJs
const fastify = require('fastify')({
  logger: true,
//  trustProxy: true // needed to get ips...
});

const fs = require('fs');


fastify.get('/', async function( request, reply ) {

  await fs.readFile( 'log.json', 'utf8', function( err, data ) {
    if ( err ) throw err;
    reply.send( data );
  } );
  
} );


fastify.post( '/', function( request, reply ) {
  
  const oldLogString = fs.readFileSync( 'log.json', 'utf8' ),
        oldLog = JSON.parse( oldLogString );
  
  const newLogItem = JSON.parse( request.body );
  newLogItem.time = new Date();
  // newLogItem.ip = request.ips[ request.ips.length - 1 ];
  // newLogItem.userAgent = request.headers[ "user-agent" ];
  
  const newLog = [ newLogItem ].concat( oldLog ),
        logString = JSON.stringify( newLog, null, 2 );
  
  fs.writeFile( 'log.json', logString, function( err ) {
    if ( err ) throw err;
  } );
  
  reply.send( JSON.stringify( newLogItem, null, 2 ) ); // helped me test...
  
} );


fastify.delete( '/', function( request, reply ) {
  
  
  fs.writeFile( 'log.json', '[]', function( err ) {
    if ( err ) throw err;
  } );
  
  reply.code(204).send( null );
  
} );


// Run the server!
fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
  // Server is now listening on ${address}
} );