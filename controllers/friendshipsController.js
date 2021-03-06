const { body, validationResult } = require('express-validator');
const authenticated = require('../middlewares/authenticated');
const validMongoObjectIdRouteParams = require('../middlewares/validMongoObjectIdRouteParams');
const getResourceFromParams = require('../middlewares/getResourceFromParams');
// eslint-disable-next-line no-unused-vars
const Friendship = require('../models/friendship');
const User = require('../models/user');

exports.create = [
	authenticated,
	// Validate field.
	body('requesteeId')
		.isMongoId()
		.withMessage('requesteeId is not a valid Mongo ID'),
	// Validation.
	async (req, res, next) => {
		// Extract the validation errors from a request.
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			// There are errors.
			res.status(422).json({
				errors: errors.array(),
				friendship: req.body,
			});
		} else if (req.currentUser._id.toString() === req.body.requesteeId) {
			// If currentUser sends a friend request to themselves.
			const err = new Error('Cannot send a friend request to yourself.');
			err.status = 422;
			next(err);
		} else {
			try {
				// Finds the relationship between currentUser and the requestee.
				const friendship = await req.currentUser.findRelationshipWith(
					req.body.requesteeId
				);
				if (friendship) {
					let err;
					switch (friendship.status) {
						case 'pending':
							err = new Error('You already sent a friend request to them.');
							break;
						case 'friends':
							err = new Error("You're already friends with them.");
							break;
					}
					err.status = 422;
					next(err);
				} else {
					next();
				}
			} catch (err) {
				next(err);
			}
		}
	},
	async (req, res, next) => {
		try {
			// Create the new friendship
			const friendship = await req.currentUser.sendFriendRequest(
				req.body.requesteeId
			);
			res.status(201).json({ friendship });
		} catch (err) {
			next(err);
		}
	},
];

exports.update = [
	authenticated,
	validMongoObjectIdRouteParams,
	getResourceFromParams('Friendship'),
	async (req, res, next) => {
		try {
			const friendship = req.friendship;
			if (!friendship.requestee.equals(req.currentUser._id)) {
				// If requestee is not the currentUser
				const err = new Error('Not a valid friend request.');
				err.status = 401;
				throw err;
			} else if (friendship.status !== 'pending') {
				const err = new Error('Friend request is already accepted.');
				err.status = 400;
				throw err;
			} else {
				// Successful
				// Accept friend request.
				friendship.status = 'friends';
				const updatedFriendship = await friendship.save();
				res.json({ friendship: updatedFriendship });
			}
		} catch (err) {
			next(err);
		}
	},
];

exports.destroy = [
	authenticated,
	validMongoObjectIdRouteParams,
	getResourceFromParams('Friendship'),
	async (req, res, next) => {
		try {
			const friendship = req.friendship;
			if (
				!(
					friendship.requestor.equals(req.currentUser._id) ||
					friendship.requestee.equals(req.currentUser._id)
				)
			) {
				// If currentUser is not the requestor or the requestee.
				const err = new Error('Not a valid friend request.');
				err.status = 401;
				throw err;
			} else {
				// Successful
				// Remove friendship.
				const removedFriendship = await friendship.remove();
				res.json({ friendship: removedFriendship });
			}
		} catch (err) {
			next(err);
		}
	},
];

exports.friendRequests = [
	authenticated,
	validMongoObjectIdRouteParams,
	// Check if user exists.
	async (req, res, next) => {
		try {
			const user = await User.findById(req.params.userId);
			if (user === null) {
				const err = new Error('User not found');
				err.status = 404;
				next(err);
			} else {
				req.user = user;
				next();
			}
		} catch (err) {
			next(err);
		}
	},
	// Check if user is the currentUser
	(req, res, next) => {
		if (!req.user._id.equals(req.currentUser._id)) {
			const err = new Error('Invalid JWT');
			err.status = 401;
			next(err);
		} else {
			req.user = undefined;
			next();
		}
	},
	async (req, res, next) => {
		try {
			const totalFriendships = await Friendship.countDocuments({
				requestee: req.currentUser._id,
				status: 'pending',
			}).exec();
			if (req.query.noDocs) {
				res.json({ totalFriendships });
			} else {
				req.totalFriendships = totalFriendships;
				next();
			}
		} catch (err) {
			next(err);
		}
	},
	async (req, res, next) => {
		try {
			const friendships = await Friendship.find({
				requestee: req.currentUser._id,
				status: 'pending',
			})
				.skip(req.skip)
				.limit(req.query.limit)
				.sort({ updatedAt: -1 })
				.populate('requestor')
				.exec();
			res.json({ friendships, totalFriendships: req.totalFriendships });
		} catch (err) {
			next(err);
		}
	},
];
