// needs to be set to 8MHz
// /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -U lfuse:w:0xc2:m

#define F_CPU 8000000UL
/* Includes */
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#define VERSION_MAJOR 0
#define VERSION_MINOR 2

/* Prototypes */
void USART0_Init( unsigned int baudrate );
unsigned char USART0_Receive( void );
void USART0_Transmit( unsigned char data );
unsigned char USART0_DataReady( void );

volatile uint8_t bits = 8;
volatile char rx = 0;

#define read_rx() ( PINA  &   ( 1 << PA7 ) )
#define read_a() ( PINB  &   ( 1 << PB0 ) )
#define read_b() ( PINB  &   ( 1 << PB1 ) )

volatile int8_t encoderPos = 0;

#define BUFSIZE (255)
volatile static char           inbuf[BUFSIZE];
volatile static uint8_t  qin;
static uint8_t           qout;

void init( void )
{
	unsigned char sreg_tmp;
	
	sreg_tmp = SREG;
	cli();
	
	OCR1A = 100;     /* set top (~100us) */
	TCNT1 = 0; /* reset counter */
	
	SREG = sreg_tmp;

	DDRA &= ~( 1 << PA7 ); // set GPS rx as input
	DDRB &= ~( 1 << PB0 ); // set knob a as input
	DDRB &= ~( 1 << PB1 ); // set knob b as input

	USART0_Init( 12 ); /* Set the baudrate to 38400 bps using a 8.0000MHz INTOSC/crystal */

	PCMSK0 = 1<<PCINT7; // enable PCINT7 (GPS serial in)
	PCMSK1 = 1<<PCINT8 | 1<<PCINT9; // enable knob interrupt
	GIMSK = 1<<PCIE0 | 1<<PCIE1; // enable pcint
}

void rec_char(char c)
{
	inbuf[qin] = c;
	if ( ++qin >= BUFSIZE ) {
		// overflow - reset inbuf-index
		qin = 0;
	}
}

char getchar( void )
{
	char ch;

	if ( qout == qin ) {
		return 0;
	}
	ch = inbuf[qout];
	if ( ++qout >= BUFSIZE ) {
		qout = 0;
	}
	
	return( ch );
}

uint8_t scanbuf( char c )
{
	uint8_t s = qout;
	for(uint8_t i = 0; i < BUFSIZE; i++) {
		if(inbuf[s] == c) {
			return 1;
		}
		if(++s == qin) break;
	}
	return 0;
}

uint8_t char_waiting( void )
{
	return( qin != qout );
}

void flush_buffer( void )
{
	qin  = 0;
	qout = 0;
}
	

ISR(PCINT1_vect)
{
    static int8_t aPrev = -1, bPrev = -1;

    int aNow = (read_a() == 0);
    int bNow = (read_b() == 0);
    if((aNow != aPrev || bNow != bPrev) && bNow && aNow && aPrev >= 0)
    {
        if(!aPrev) {
            encoderPos++;
        }
        else if(!bPrev) {
            encoderPos--;     
        } 
    }
    aPrev = aNow;
    bPrev = bNow;
}

ISR(PCINT0_vect)
{
	if(!read_rx()) { // falling edge for start bit
		PCMSK0 = 0;
		bits = 8;
		rx = 0;
		TCNT1 = 0; /* reset counter */
		TCCR1A = 1 << WGM11;
		TCCR1B = 1 << CS11;
		TIMSK1 = 1 << OCIE1A;
	}
}

ISR(TIMER1_COMPA_vect)
{
	TCNT1 = 0; /* reset counter */
	bits--;
	if( read_rx() ) {
		rx |= 1<<(7-bits);
	}
	if(bits == 0) {
		TIMSK1 = 0;
		TCCR1A = 0;
		TCCR1B = 0;
		PCMSK0 = 1<<PCINT7;
		rec_char(rx);
	}
}

/* Main - a simple test program*/
int main( void )
{
	char c;
	int i;	

	init();

	sei();

	for(;;) 	    /* Forever */
	{
		if ( char_waiting() ) {
			if(scanbuf('\n')) {
				c = getchar();
				if(c == '$') {
					while(c) {
						USART0_Transmit(c);
						c = getchar();
						if(c == '\n' || c == '\r') {
							break;
						}
					}
					c = getchar();
					USART0_Transmit('\r');
					USART0_Transmit('\n');
				} else {
					flush_buffer();
				}
			}
		}
		if(USART0_DataReady()) {
			c = USART0_Receive();
			if(c == 'V') {
				USART0_Transmit('V');
				USART0_Transmit('0' + VERSION_MAJOR);
				USART0_Transmit('0' + VERSION_MINOR);
				USART0_Transmit('\r');
				USART0_Transmit('\n');
			}
		}
		if(encoderPos) {
			USART0_Transmit('K');
			if(encoderPos < 0) {
				USART0_Transmit('-');
				encoderPos = 0 - encoderPos;
			} else {
				USART0_Transmit('+');
			}
			USART0_Transmit('0' + encoderPos);
			USART0_Transmit('\r');
			USART0_Transmit('\n');
			encoderPos = 0;
		}
	}
}

/* Initialize UART */
void USART0_Init( unsigned int baudrate )
{
	/* Set the baud rate */
	UBRR0H = (unsigned char) (baudrate>>8);
	UBRR0L = (unsigned char) baudrate;
	
	/* Enable UART receiver and transmitter */
	UCSR0B = ( ( 1 << RXEN0 ) | ( 1 << TXEN0 ) );
	
	/* Set frame format: 8 data 2stop */
	UCSR0C = (1<<USBS0)|(1<<UCSZ01)|(1<<UCSZ00);              //For devices with Extended IO
	//UCSR0C = (1<<URSEL)|(1<<USBS0)|(1<<UCSZ01)|(1<<UCSZ00);   //For devices without Extended IO
}


/* Read and write functions */
unsigned char USART0_Receive( void )
{
	/* Wait for incomming data */
	while ( !(UCSR0A & (1<<RXC0)) );
	/* Return the data */
	return UDR0;
}

unsigned char USART0_DataReady( void )
{
	return (UCSR0A & (1<<RXC0));
}

void USART0_Transmit( unsigned char data )
{
	/* Wait for empty transmit buffer */
	while ( !(UCSR0A & (1<<UDRE0)) );
	/* Start transmittion */
	UDR0 = data;
}

