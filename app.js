require('dotenv').config();

const path = require('path');
const { mkdir } = require('fs');
const express = require('express');
const logger = require('morgan');
const paginate = require('express-paginate');
const passportConfig = require('./configs/passportConfig');
const { setCurrentUser } = require('./lib/middlewares');

mkdir('public/images', { recursive: true }, (err) => {
	if (err) {
		throw err;
	}
});

const app = express();

// Routers
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const friendshipsRouter = require('./routes/friendships');
const postsRouter = require('./routes/posts');
const reactionsRouter = require('./routes/reactions');
const commentsRouter = require('./routes/comments');

// Exlcude connecting to the real database
if (process.env.NODE_ENV !== 'test') {
	// Set up default mongoose connection
	require('./configs/mongoConfig');
}

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(passportConfig.initialize({ userProperty: 'currentUser' }));
app.use(setCurrentUser);
/* First parameter is used if req.query.limit is not supplied. 
	   Not a minimum value.
	 Second parameter is max value of req.query.limit.
*/
app.use(paginate.middleware(10, 50));
/* Set pagination default or minimum limit per page.
	 This override paginate.middleware() first parameter.
*/
app.get(['/users', '/posts'], (req, res, next) => {
	if (req.query.limit < 9) {
		req.query.limit = 10;
	}
	next();
});

// Use routers
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/friendships', friendshipsRouter);
app.use('/posts', postsRouter);
app.use('/posts/:postId/reactions', reactionsRouter);
app.use('/posts/:postId/comments', commentsRouter);

// Error handler
app.use((err, req, res, next) => {
	res.status(err.status || 500).send({
		err: { ...err, message: err.message },
	});
});

module.exports = app;
