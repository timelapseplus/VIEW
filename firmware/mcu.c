// needs to be set to 8MHz
// /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -U lfuse:w:0xc2:m

#define F_CPU 8000000UL
/* Includes */
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#define VERSION_MAJOR 1
#define VERSION_MINOR 0

/* Prototypes */
void USART0_Init( unsigned int baudrate );
unsigned char USART0_Receive( void );
void USART0_Transmit( unsigned char data );
unsigned char USART0_DataReady( void );

volatile uint8_t bits_gps = 8;
volatile char rx_gps = 0;
volatile uint8_t bits_aux = 8;
volatile char rx_aux = 0;
volatile uint8_t bits_auxout = 8;
volatile char byte_auxout = 0;
volatile uint8_t aux_tx_sending = 0;
volatile uint8_t aux_tx_enabled = 0;

#define read_rx_gps() ( PINA  &   ( 1 << PA7 ) )
#define read_rx_aux() ( PINA  &   ( 1 << PA0 ) )
#define set_tx_aux() PORTB  |=   ( 1 << PB2 )
#define clr_tx_aux() PORTB  &=   ~( 1 << PB2 )
#define enable_tx_aux() DDRB  |=   ( 1 << PB2 )
#define disable_tx_aux() DDRB  &=   ~( 1 << PB2 )
#define read_a() ( PINB  &   ( 1 << PB0 ) )
#define read_b() ( PINB  &   ( 1 << PB1 ) )

volatile int8_t encoderPos = 0;

#define BUFSIZE (192)
volatile static char     inbuf_gps[BUFSIZE];
volatile static uint8_t  qin_gps;
static uint8_t           qout_gps;

volatile static char     inbuf_aux[BUFSIZE];
volatile static uint8_t  qin_aux;
static uint8_t           qout_aux;

volatile static char     inbuf_auxout[BUFSIZE];
volatile static uint8_t  qin_auxout;
static uint8_t           qout_auxout;

void init( void )
{
	unsigned char sreg_tmp;
	
	sreg_tmp = SREG;
	cli();
	
	OCR1A = 100;     /* set top (~100us), 9600 baud */
	TCNT1 = 0; /* reset counter */

	OCR2A = 14;     /* set top (~17us), 57600 baud */
	TCNT2 = 0; /* reset counter */

	OCR0A = 139;     /* set top (~17us), 57600 baud */
	
	SREG = sreg_tmp;

	DDRA &= ~( 1 << PA7 ); // set GPS rx as input
	DDRA &= ~( 1 << PA0 ); // set AUX rx as input
	DDRB &= ~( 1 << PB0 ); // set knob a as input
	DDRB &= ~( 1 << PB1 ); // set knob b as input

	USART0_Init( 12 ); /* Set the baudrate to 38400 bps using a 8.0000MHz INTOSC/crystal */

	PCMSK0 = 1<<PCINT7; // enable PCINT7 (GPS serial in)
	PCMSK0 |= 1<<PCINT0; // enable PCINT0 (AUX serial in)
	PCMSK1 = 1<<PCINT8 | 1<<PCINT9; // enable knob interrupt
	GIMSK = 1<<PCIE0 | 1<<PCIE1; // enable pcint
}

void setup_tx_aux(uint8_t en)
{
	if(en) {
		set_tx_aux();
		enable_tx_aux();
		aux_tx_enabled = 1;
	} else {
		clr_tx_aux();
		disable_tx_aux();
		aux_tx_enabled = 0;
	}
}

void rec_char_gps(char c)
{
	inbuf_gps[qin_gps] = c;
	if ( ++qin_gps >= BUFSIZE ) {
		// overflow - reset inbuf-index
		qin_gps = 0;
	}
}

char getchar_gps( void )
{
	char ch;

	if ( qout_gps == qin_gps ) {
		return 0;
	}
	ch = inbuf_gps[qout_gps];
	if ( ++qout_gps >= BUFSIZE ) {
		qout_gps = 0;
	}
	
	return( ch );
}

uint8_t scanbuf_gps( char c )
{
	uint8_t s = qout_gps;
	for(uint8_t i = 0; i < BUFSIZE; i++) {
		if(inbuf_gps[s] == c) {
			return 1;
		}
		if(++s == qin_gps) break;
	}
	return 0;
}

uint8_t char_waiting_gps( void )
{
	return( qin_gps != qout_gps );
}

void flush_buffer_gps( void )
{
	qin_gps  = 0;
	qout_gps = 0;
}
	
void rec_char_aux(char c)
{
	inbuf_aux[qin_aux] = c;
	if ( ++qin_aux >= BUFSIZE ) {
		// overflow - reset inbuf-index
		qin_aux = 0;
	}
}

char getchar_aux( void )
{
	char ch;

	if ( qout_aux == qin_aux ) {
		return 0;
	}
	ch = inbuf_aux[qout_aux];
	if ( ++qout_aux >= BUFSIZE ) {
		qout_aux = 0;
	}
	
	return( ch );
}

uint8_t scanbuf_aux( char c )
{
	uint8_t s = qout_aux;
	for(uint8_t i = 0; i < BUFSIZE; i++) {
		if(inbuf_aux[s] == c) {
			return 1;
		}
		if(++s == qin_aux) break;
	}
	return 0;
}

uint8_t char_waiting_aux( void )
{
	return( qin_aux != qout_aux );
}

void flush_buffer_aux( void )
{
	qin_aux  = 0;
	qout_aux = 0;
}
	

void rec_char_auxout(char c)
{
	if(!c) return;
	inbuf_auxout[qin_auxout] = c;
	if ( ++qin_auxout >= BUFSIZE ) {
		// overflow - reset inbuf-index
		qin_auxout = 0;
	}
}

char getchar_auxout( void )
{
	char ch;

	if ( qout_auxout == qin_auxout ) {
		return 0;
	}
	ch = inbuf_auxout[qout_auxout];
	if ( ++qout_auxout >= BUFSIZE ) {
		qout_auxout = 0;
	}
	
	return( ch );
}

void send_auxout(char c)
{
	if(!aux_tx_enabled) return;
	rec_char_auxout(c);
	if(!aux_tx_sending)
	{
		aux_tx_sending = 1;
		byte_auxout = getchar_auxout();
		bits_auxout = 0;
		if(byte_auxout)
		{
			TCNT0 = 0;
			TCCR0A = 1 << WGM01;
			TCCR0B = 1 << CS00; //no prescale, 8MHz
			TIMSK0 = 1 << OCIE0A;
		}
	
	}
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
	if(!read_rx_gps()) { // falling edge for start bit
		PCMSK0 &= ~(1<<PCINT7);
		bits_gps = 8;
		rx_gps = 0;
		TCNT1 = 0; /* reset counter */
		TCCR1A = 1 << WGM11;
		TCCR1B = 1 << CS11;
		TIMSK1 = 1 << OCIE1A;
	}
	if(!read_rx_aux()) { // falling edge for start bit
		PCMSK0 &= ~(1<<PCINT0);
		bits_aux = 8;
		rx_aux = 0;
		TCNT2 = 0; /* reset counter */
		TCCR2A = 1 << WGM21;
		TCCR2B = 1 << CS21;
		TIMSK2 = 1 << OCIE2A;
	}
}

ISR(TIMER0_COMPA_vect)
{
	TCNT0 = 0; /* reset counter */
	if(bits_auxout == 0) 
	{
		clr_tx_aux(); // start bit
	} 
	else if(bits_auxout <= 8) 
	{
		if(byte_auxout & 1<<(8-bits_auxout))
		{
			set_tx_aux(); // send 1
		}
		else
		{
			clr_tx_aux(); // send 0
		}
	} 
	else if(bits_auxout <= 10) 
	{
		set_tx_aux(); // stop bit
	} 
	else 
	{
		//setup next
		byte_auxout = getchar_auxout();
		bits_auxout = 0;
		if(!byte_auxout)
		{
			aux_tx_sending = 0;
			TCCR0A = 0;
			TCCR0B = 0;
		}
		return;
	}
	bits_auxout++;
}

ISR(TIMER1_COMPA_vect)
{
	TCNT1 = 0; /* reset counter */
	bits_gps--;
	if( read_rx_gps() ) {
		rx_gps |= 1<<(7-bits_gps);
	}
	if(bits_gps == 0) {
		TIMSK1 = 0;
		TCCR1A = 0;
		TCCR1B = 0;
		PCMSK0 |= 1<<PCINT7;
		rec_char_gps(rx_gps);
	}
}

ISR(TIMER2_COMPA_vect)
{
	TCNT2 = 0; /* reset counter */
	bits_aux--;
	if( read_rx_aux() ) {
		rx_aux |= 1<<(7-bits_aux);
	}
	if(bits_aux == 0) {
		TIMSK2 = 0;
		TCCR2A = 0;
		TCCR2B = 0;
		PCMSK0 |= 1<<PCINT0;
		rec_char_aux(rx_aux);
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
		if ( char_waiting_gps() ) {
			if(scanbuf_gps('\n')) {
				c = getchar_gps();
				if(c == '$') {
					while(c) {
						USART0_Transmit(c);
						c = getchar_gps();
						if(c == '\n' || c == '\r') {
							break;
						}
					}
					c = getchar_gps();
					USART0_Transmit('\r');
					USART0_Transmit('\n');
				} else {
					flush_buffer_gps();
				}
			}
		}
		if ( char_waiting_aux() ) {
			if(scanbuf_aux('\n')) {
				USART0_Transmit('@');
				c = getchar_aux();
				while(c) {
					USART0_Transmit(c);
					c = getchar_aux();
					if(c == '\n' || c == '\r') {
						break;
					}
				}
				c = getchar_aux();
				USART0_Transmit('\r');
				USART0_Transmit('\n');
			}
		}
		if(USART0_DataReady()) {
			c = USART0_Receive();
			if(c == 'V') 
			{
				USART0_Transmit('V');
				USART0_Transmit('0' + VERSION_MAJOR);
				USART0_Transmit('0' + VERSION_MINOR);
				USART0_Transmit('\r');
				USART0_Transmit('\n');
			}
			else if(c == '@') // send data out AUX
			{
				while(USART0_DataReady()) {
					c = USART0_Receive();
					send_auxout(c);
				}
			}
			else if(c == '#') // enable AUX tx
			{
				setup_tx_aux(1);
			}
			else if(c == '~') // disable AUX tx
			{
				setup_tx_aux(0);
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

