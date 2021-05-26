const fs = require('fs/promises');
const { body, validationResult } = require('express-validator');
const { upload } = require('../configs/multerConfig');
const {
	authenticated,
	validMongoObjectIdRouteParams,
	getResourceFromParamsAndCurrentUserIsTheAuthor,
} = require('../lib/middlewares');
const Post = require('../models/post');

const postValidationAndSanitation = [
	body('text')
		.trim()
		.isLength({ min: 1 })
		.withMessage('Text is required')
		.isLength({ max: 1000 })
		.withMessage('Text is too long (maximum is 1000 characters)')
		.escape(),
];

exports.index = [
	authenticated,
	async (req, res, next) => {
		try {
			const friends = await req.currentUser.getFriends();
			const friendsIds = friends.map((friend) => friend._id);
			const userIds = [req.currentUser._id, ...friendsIds];
			// currentUser and friends posts per page.
			const posts = await Post.find({})
				.where('author')
				.in(userIds)
				.skip(req.skip)
				.limit(req.query.limit)
				.sort({ createdAt: -1 })
				.populate('author reactions')
				.exec();
			const postsCount = await Post.countDocuments({
				author: { $in: userIds },
			}).exec();
			res.json({ posts, postsCount });
		} catch (err) {
			next(err);
		}
	},
];

exports.create = [
	authenticated,
	(req, res, next) => {
		upload.single('image')(req, res, (err) => {
			if (err) {
				req.multerErr = err;
			}
			next();
		});
	},
	// Validate and sanitise fields.
	...postValidationAndSanitation,
	// Process request after validation and sanitization.
	async (req, res, next) => {
		// Extract the validation errors from a request.
		const errors = validationResult(req);
		try {
			// There is multerErr or express-validator errors.
			if (req.multerErr || !errors.isEmpty()) {
				// If there's an uploaded image delete it.
				if (req.file) {
					await fs.unlink(`public/images/${req.file.filename}`);
				}
				const multerErrInArray = req.multerErr
					? [{ msg: req.multerErr.message }]
					: [];
				res.status(422).json({
					errors: multerErrInArray.concat(errors.array()),
					post: req.body,
				});
			} else {
				// Data is valid.
				// Create an Post object with escaped and trimmed data.
				const post = await Post.create({
					author: req.currentUser._id,
					text: req.body.text,
					image: req.file ? req.file.filename : '',
				});
				req.currentUser.posts.push(post._id);
				req.currentUser.save((err) => {
					if (err) {
						post.remove((err) => {
							if (err) {
								throw err;
							}
						});
						throw err;
					} else {
						res.status(201).json({ post });
					}
				});
			}
		} catch (err) {
			// If there's an uploaded image delete it.
			if (req.file) {
				(async () => {
					await fs.unlink(`public/images/${req.file.filename}`);
				})();
			}
			next(err);
		}
	},
];

exports.show = [
	validMongoObjectIdRouteParams,
	async (req, res, next) => {
		try {
			const post = await Post.findById(req.params.postId)
				.populate('author reactions')
				.populate({
					path: 'comments',
					populate: { path: 'author' },
					options: {
						sort: { createdAt: -1 },
					},
				})
				.exec();
			if (post === null) {
				const err = new Error('Page not found');
				err.status = 404;
				next(err);
			} else {
				res.json({ post });
			}
		} catch (err) {
			next(err);
		}
	},
];

exports.update = [
	authenticated,
	validMongoObjectIdRouteParams,
	getResourceFromParamsAndCurrentUserIsTheAuthor('Post'),
	// Validate and sanitise fields.
	...postValidationAndSanitation,
	// Process request after validation and sanitization.
	async (req, res, next) => {
		// Extract the validation errors from a request.
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			// There are errors.
			res.status(422).json({
				errors: errors.array(),
				post: req.body,
			});
		} else {
			// Data is valid.
			try {
				const post = req.post;
				// Successful
				// Update the record with escaped and trimmed data.
				post.text = req.body.text;
				const updatedPost = await post.save();
				res.json({ post: updatedPost });
			} catch (err) {
				next(err);
			}
		}
	},
];

exports.updateImage = [
	authenticated,
	validMongoObjectIdRouteParams,
	getResourceFromParamsAndCurrentUserIsTheAuthor('Post'),
	(req, res, next) => {
		upload.single('image')(req, res, (err) => {
			if (err) {
				req.multerErr = err;
			}
			next();
		});
	},
	async (req, res, next) => {
		try {
			// If there's a multer error or the user didn't upload an image.
			if (req.multerErr || !req.file) {
				let errors = [];
				if (req.file) {
					await fs.unlink(`public/images/${req.file.filename}`);
				}
				if (req.multerErr) {
					errors = errors.concat({
						msg: req.multerErr.message,
					});
				}
				if (!req.file) {
					errors = errors.concat({
						msg: 'Upload an image',
					});
				}
				res.status(422).json({
					errors,
					image: req.file ? req.file.filename : '',
				});
			} else {
				// Data form is valid.
				// Update post's image
				const post = req.post;
				// Delete the old profilePicture if there's any.
				if (post.image !== '') {
					await fs.unlink(`public/images/${post.image}`);
				}
				post.image = req.file.filename;
				const updatedPost = await post.save();
				// Successful
				res.status(200).json({ image: updatedPost.image });
			}
		} catch (err) {
			// If there's an uploaded image delete it.
			if (req.file) {
				(async () => {
					await fs.unlink(`public/images/${req.file.filename}`);
				})();
			}
			next(err);
		}
	},
];

exports.destroy = [
	authenticated,
	validMongoObjectIdRouteParams,
	getResourceFromParamsAndCurrentUserIsTheAuthor('Post'),
	async (req, res, next) => {
		try {
			const post = req.post;
			// Successful
			// Remove post.
			const removedPost = await post.remove();
			res.json({ post: removedPost });
		} catch (err) {
			next(err);
		}
	},
];
