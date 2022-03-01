
// Require the framework and instantiate it

// CommonJs
const fastify = require( 'fastify' )( {
  logger: true,
//  trustProxy: true // needed to get ips...
} );

const fs = require( 'fs' );
const { FastifySSEPlugin } = require( 'fastify-sse-v2' );
// const EventIterator = require('event-iterator');
const { on, EventEmitter } = require( 'events' );
fastify.register( FastifySSEPlugin) ;

const ee = new EventEmitter();

fastify.get( "/events", function ( req, res ) {
  res.header( "Access-Control-Allow-Origin", "*" );
  res.sse(
    ( async function* () {
      for await ( const event of on( ee, 'update' ) ) {
        console.log(event.name)
        yield {
          data: JSON.stringify( event )
        };
      }
    } )()
  );
});



// fastify.get("/", function (req, res) {
//     res.header("Access-Control-Allow-Origin","*");
//     res.sse((async function * source () {
//           for (let i = 0; i < 10; i++) {
//             await new Promise(resolve => setTimeout(resolve, 1000));
//             yield {id: String(i), data: "Some message"};  
//           }
//     })());
// });


// fastify.get('/', function( request, reply ) {

//   fs.readFile( 'log.json', 'utf8', function( err, data ) {
//     if ( err ) throw err;
//     reply.send( data );
//   } );
  
// } );


fastify.post( '/', function( request, reply ) {

  const newLogItem = JSON.parse( request.body );
  ee.emit( 'update', newLogItem);  
  reply.send( JSON.stringify( newLogItem ) ); // helped me test...
  
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