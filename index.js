const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000 ; 

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';



const corsOptions = {
  origin: 'https://aelevenclient.vercel.app', 
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));  

app.use(express.json());


const generateToken = (email) => {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).send({ message: 'Invalid or expired token' });
  }
};

app.post('/jwt', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ message: 'Email is required' });

  const token = generateToken(email);
  res.send({ token });
});



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vdaznfz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const booksCollection = client.db('bookDB').collection('books')


app.get('/books', async (req, res) => {
  const email = req.query.email;
  const query = email ? { email } : {};
  const result = await booksCollection.find(query).toArray();
  res.send(result);
});


    app.get('/books/categories/test', (req, res) => {
  res.send(' Categories test route working');
});

       app.get('/books/categories', async (req, res) => {
  try {
    const result = await booksCollection.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    res.send(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send({ message: "Failed to fetch categories" });
  }
});
    
app.get('/books/:id', async (req, res) => {
  const id = req.params.id;
  console.log('[HIT] /books/:id →', id); 
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book ID" });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send(book);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server error" });
  }
});
app.patch('/books/:id/upvote', verifyToken, async (req, res) => {
  const bookId = req.params.id;
  const { userEmail } = req.body;

  if (!ObjectId.isValid(bookId)) {
    return res.status(400).send({ message: 'Invalid book ID' });
  }

  try {
    const query = { _id: new ObjectId(bookId) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: 'Book not found' });
    }

    if (book.email === userEmail) {
      return res.status(403).send({ message: 'You cannot upvote your own book' });
    }

    const currentUpvote = typeof book.upvote === "number" ? book.upvote : parseInt(book.upvote, 10) || 0;

    const update = {
      $inc: { upvote: 1 }
    };

    if (isNaN(currentUpvote)) {
      update.$set = { upvote: 0 };  
    }

    const result = await booksCollection.updateOne(query, update);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.post('/books/:id/reviews', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userEmail, reviewText } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid book ID' });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: 'Book not found' });
    }

    const existingReview = book.reviews?.find(review => review.userEmail === userEmail);
    if (existingReview) {
      return res.status(400).send({ message: 'You can only submit one review per book' });
    }

    const newReview = {
      _id: new ObjectId(), 
      userEmail,
      reviewText,
      createdAt: new Date(),
    };

    const update = {
      $push: { reviews: newReview },
    };

    await booksCollection.updateOne(query, update);

    res.status(200).send({ review: newReview });

  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});



app.put('/books/:id/reviews', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userEmail, reviewText } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid book ID' });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: 'Book not found' });
    }

    const reviewIndex = book.reviews?.findIndex(review => review.userEmail === userEmail);
    if (reviewIndex === -1) {
      return res.status(404).send({ message: 'Review not found' });
    }

    const update = {
      $set: { [`reviews.${reviewIndex}.reviewText`]: reviewText },
    };

    const result = await booksCollection.updateOne(query, update);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.delete('/books/:id/reviews', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid book ID' });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: 'Book not found' });
    }

    const reviewIndex = book.reviews?.findIndex(review => review.userEmail === userEmail);
    if (reviewIndex === -1) {
      return res.status(404).send({ message: 'Review not found' });
    }

    const update = {
      $pull: { reviews: { userEmail } },
    };

    const result = await booksCollection.updateOne(query, update);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Server error' });
  }
});

app.delete('/books/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid book ID' });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: 'Book not found' });
    }

    if (book.email !== userEmail) {
      return res.status(403).send({ message: 'Unauthorized delete attempt' });
    }

    const result = await booksCollection.deleteOne(query);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Server error' });
  }
});

app.put('/books/:id', async (req, res) => {
  const { id } = req.params;
  const updatedBook = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid book ID' });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const update = {
      $set: updatedBook
    };

    const result = await booksCollection.updateOne(query, update);

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'Book not found' });
    }

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Server error' });
  }
});


app.patch('/books/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;

  const validStatuses = ["Want to Read", "Currently Reading", "Read"];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).send({ message: "Invalid status" });
  }

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book ID" });
  }

  try {
    const query = { _id: new ObjectId(id) };
    const book = await booksCollection.findOne(query);

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    if (book.email !== req.body.userEmail) {
      return res.status(403).send({ message: "You can only update your own book" });
    }

    const update = {
      $set: { status: newStatus },
    };

    await booksCollection.updateOne(query, update);
    res.send({ message: "Status updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server error" });
  }
});



app.post('/books', async (req, res) => {
  const newBook = req.body;
  newBook.upvote = typeof newBook.upvote === "number" ? newBook.upvote : 0;  
  
  const result = await booksCollection.insertOne(newBook);
  res.send(result);
});


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Book server is running...')
});

app.listen(port, () => {
    console.log(`Book server is running on port ${port}`)
});

