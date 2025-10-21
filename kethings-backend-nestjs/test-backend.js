const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testBackend() {
  try {
    console.log('Creating NestJS application...');
    const app = await NestFactory.create(AppModule, { cors: true });
    
    console.log('Setting global prefix...');
    app.setGlobalPrefix('api');
    
    console.log('Starting application...');
    const port = Number(process.env.PORT || 8080);
    await app.listen(port);
    
    console.log(`Backend started successfully on port ${port}`);
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error starting backend:', error);
    process.exit(1);
  }
}

testBackend();


