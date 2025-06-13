import { getUserServiceProducer, KafkaConsumer, TOPICS, CONSUMER_GROUPS } from '/app/shared/kafka.js';
import  UserService  from '../services/userService.js';
import prisma from '/app/src/config/db.js';
import performance from '../utils/performance.js';

// Initialize Kafka producer for user service
export const initKafkaProducer = async () => {
  try {
    const producer = await getUserServiceProducer();
    console.log('User service Kafka producer initialized');
    return producer;
  } catch (error) {
    console.error('Failed to initialize Kafka producer for user service:', error);
    // Don't crash the service if Kafka isn't available
    return null;
  }
};

// Initialize a consumer for auth events that user service might need to respond to
export const initKafkaConsumer = async () => {
  try {
    const consumer = new KafkaConsumer(
      CONSUMER_GROUPS.USER_SERVICE,
      [TOPICS.USER_CREATED] // Subscribe to relevant topics
    );
    
    // Set up handlers for different events
    consumer.onMessage(TOPICS.USER_CREATED, handleUserCreatedEvent);
    
    await consumer.connect();
    console.log('User service Kafka consumer initialized');
    return consumer;
  } catch (error) {
    console.error('Failed to initialize Kafka consumer for user service:', error);
    // Don't crash the service if Kafka isn't available
    return null;
  }
};

// Handler for user created events
const handleUserCreatedEvent = async (message) => {
  // Check if this is a registration status update
  if (message.registrationStatus === 'COMPLETE') {
    console.log('Received registration completion event for user:', message.authId);
    return;
  }
  
  try {
    const userServiceInstance = new UserService(prisma, performance);
    // Check if user already exists before creating
    const existingUser = await prisma.user.findUnique({
      where: { authUserId: message.authId }
    });
    
    if (existingUser) {
      console.log('User already exists in user service DB for authId:', message.authId);
      return;
    }
    
    await userServiceInstance.createUser({
      authUserId: message.authId,
      username: message.username,
    });
    console.log('User created in user service DB for authId:', message.authId);
  } catch (err) {
    console.error('Error creating user in user service DB for authId:', message.authId, err);
  }
  
};



// Initialize Kafka when the module is imported
export const initKafka = async () => {
  const producer = await initKafkaProducer();
  const consumer = await initKafkaConsumer();
  
  return { producer, consumer };
};