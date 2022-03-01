
// fastify
const fastify = require( 'fastify' )( {
  logger: true,
//  trustProxy: true // needed to get ips...
} );

// server-sent events stuff
const { FastifySSEPlugin } = require( 'fastify-sse-v2' );
// const EventIterator = require('event-iterator');
const { on, EventEmitter } = require( 'events' );
fastify.register( FastifySSEPlugin) ;

// serve GET root statically
const path = require('path');
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public')
})


// receive new beacons

fastify.post( '/', function( request, reply ) {

  const newLogItem = request.body;
  console.log( request.body );
  ee.emit( 'update', newLogItem );  
  reply.send( JSON.stringify( newLogItem ) ); // helped me test...
  
} );



// send events to EventSource subscribers (like index.html)

const ee = new EventEmitter();

fastify.get( "/events", function ( req, res ) {
  res.header( "Access-Control-Allow-Origin", "*" );
  res.sse(
    ( async function* () {
      for await ( const event of on( ee, 'update' ) ) {
        console.log(event[0])
        yield {
          id: (new Date()).toISOString(),
          data: JSON.stringify( event[0] )
        };
      }
    } )()
  );
});



fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
} );
