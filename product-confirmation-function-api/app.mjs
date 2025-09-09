import 'dotenv/config';
import { MongoClient, ObjectId } from "mongodb";

const database = process.env.DATABASE;
const conn_string = process.env.MONGODB_CONNECTION_STRING;
const clientDB = new MongoClient(conn_string, {
  maxPoolSize: 50,         // Reduced from 100 for better resource management
  minPoolSize: 5,          // Keep some connections ready
  maxConnecting: 10,       // Reasonable connection establishment during spikes
  maxIdleTimeMS: 60000,    // Close idle connections after 1 minute
  waitQueueTimeoutMS: 5000 // Fail fast if connections aren't available
});

/*
sample product document:
{
  "user_id": ObjectId("6510f0c4e1b1c8b4d6f0a1b2"),
  "status": "pending",
}
*/

const collectionProducts = clientDB
      .db(database)
      .collection("products");

const collectionOrders = clientDB
      .db(database)
      .collection("orders");

const collectionUser = clientDB
      .db(database)
      .collection('users');

/**
 * 
 * @param {*} event 
 * @param {*} context 
 * @returns 
 */
export const lambdaHandler = async (event, context) => {
  try {
    const user_collection = await collectionUser.findOne({_id: ObjectId(event.crypto)});
    if (!user_collection) {
      return {StatusCode: 404, body: {message: `User with ID ${event.user_id} not found.`}};
    }

    if (event.status == "completed") {
      const product_ordered = await collectionOrders.UpdateOne({order_id: ObjectId(event.order_id)}, {$set: {status: "completed"}}).toArray();
      return {StatusCode: 200, body: {message: `Order status ${event.status}. 'Completed'.`}};
    }else{
      // process other statuses if needed = "cancelled"
      await returnProduct(event.order_id);
      return {StatusCode: 200, body: {message: `Order status ${event.status}. Products returned to stock.`}};
    }
  } catch (err) {
    console.log(`General error. Error: ${err.message}`)
    return {StatusCode: 500, body: {message: err.message}};
  }
};

/**
 * //returns products to stock
 * @param {*} order_id 
 * @returns 
 */
async function returnProduct(order_id) {
  const orders = await collectionOrders.find({order_id: ObjectId(order_id)}).toArray();
  if (orders.length === 0) {
    return (`Order with ID ${order_id} not found.`);
  }

  for (const order of orders) {
    const product = await collectionProducts.findOne({_id: ObjectId(order.product_id)});
    if (product) {
      await collectionProducts.updateOne(
        { _id: ObjectId(order.product_id) },
        { $set: { status: "available",  $inc: {stock : order.count}} }
      );
    }
  }
}
