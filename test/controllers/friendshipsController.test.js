const request = require('supertest');
const app = require('../../app');
const mongoConfigTesting = require('../../configs/mongoConfigTesting');
const {
	bodyHasUserProperty,
	bodyHasErrorsProperty,
	bodyHasErrProperty,
	bodyHasJwtProperty,
	bodyHasCurrentUserProperty,
	bodyHasFriendshipProperty,
} = require('../assertionFunctions');

let user1Id;
let user2Id;
let user3Id;
let user1Jwt;
let user2Jwt;
let user3Jwt;
let user1AndUser3FriendshipId;

beforeAll(async () => {
	await mongoConfigTesting.connect();
});
beforeEach(async () => {
	await mongoConfigTesting.clear();
	await request(app)
		.post('/users')
		.send({
			firstName: 'user1',
			lastName: 'user1',
			email: 'user1@example.com',
			password: 'password123',
			passwordConfirmation: 'password123',
		})
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(bodyHasUserProperty)
		.expect((res) => (user1Id = res.body.user._id))
		.expect(201);
	await request(app)
		.post('/users')
		.send({
			firstName: 'user2',
			lastName: 'user2',
			email: 'user2@example.com',
			password: 'password123',
			passwordConfirmation: 'password123',
		})
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(bodyHasUserProperty)
		.expect((res) => (user2Id = res.body.user._id))
		.expect(201);
	await request(app)
		.post('/users')
		.send({
			firstName: 'user3',
			lastName: 'user3',
			email: 'user3@example.com',
			password: 'password123',
			passwordConfirmation: 'password123',
		})
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(bodyHasUserProperty)
		.expect((res) => (user3Id = res.body.user._id))
		.expect(201);
	await request(app)
		.post('/auth/local')
		.send({
			email: 'user1@example.com',
			password: 'password123',
		})
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(bodyHasJwtProperty)
		.expect(bodyHasCurrentUserProperty)
		.expect((res) => (user1Jwt = res.body.jwt))
		.expect(200);
	await request(app)
		.post('/auth/local')
		.send({
			email: 'user2@example.com',
			password: 'password123',
		})
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(bodyHasJwtProperty)
		.expect(bodyHasCurrentUserProperty)
		.expect((res) => (user2Jwt = res.body.jwt))
		.expect(200);
	await request(app)
		.post('/auth/local')
		.send({
			email: 'user3@example.com',
			password: 'password123',
		})
		.set('Accept', 'application/json')
		.expect('Content-Type', /json/)
		.expect(bodyHasJwtProperty)
		.expect(bodyHasCurrentUserProperty)
		.expect((res) => (user3Jwt = res.body.jwt))
		.expect(200);
	// user1 sends a friend request to user3.
	await request(app)
		.post('/friendships')
		.send({
			requesteeId: user3Id,
		})
		.set('Accept', 'application/json')
		.set('Authorization', `Bearer ${user1Jwt}`)
		.expect('Content-Type', /json/)
		.expect(bodyHasFriendshipProperty)
		.expect((res) => (user1AndUser3FriendshipId = res.body.friendship._id))
		.expect(201);
});
afterAll(async () => await mongoConfigTesting.close());

describe('create', () => {
	it('should send a friend request to other user', async (done) => {
		request(app)
			.post('/friendships')
			.send({
				requesteeId: user2Id,
			})
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer ${user1Jwt}`)
			.expect('Content-Type', /json/)
			.expect(bodyHasFriendshipProperty)
			.expect(201, done);
	});

	test('should require a valid JWT', (done) => {
		request(app)
			.post('/friendships')
			.send({
				requesteeId: user2Id,
			})
			.set('Accept', 'application/json')
			.expect('Content-Type', /json/)
			.expect(bodyHasErrProperty)
			.expect(401, done);
	});

	test('should require a valid requesteeId', (done) => {
		request(app)
			.post('/friendships')
			.send({ requesteeId: 'notAMongoId123' })
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer ${user1Jwt}`)
			.expect('Content-Type', /json/)
			.expect(bodyHasFriendshipProperty)
			.expect(bodyHasErrorsProperty)
			.expect(422, done);
	});

	describe('body has friendship and errors', () => {
		test('if friendship between user already exists', async (done) => {
			await request(app)
				.post('/friendships')
				.send({
					requesteeId: user2Id,
				})
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user1Jwt}`)
				.expect(bodyHasFriendshipProperty)
				.expect(201);

			request(app)
				.post('/friendships')
				.send({
					requesteeId: user1Id,
				})
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user2Jwt}`)
				.expect(bodyHasFriendshipProperty)
				.expect(bodyHasErrorsProperty)
				.expect(422, done);
		});

		test('if user send a friend request to themselves', (done) => {
			request(app)
				.post('/friendships')
				.send({
					requesteeId: user1Id,
				})
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user1Jwt}`)
				.expect(bodyHasFriendshipProperty)
				.expect(bodyHasErrorsProperty)
				.expect(422, done);
		});
	});
});

describe('update', () => {
	it('should accept the friend request of other user', (done) => {
		request(app)
			.put(`/friendships/${user1AndUser3FriendshipId}`)
			.set('Accept', 'application/json')
			.set('Authorization', `Bearer ${user3Jwt}`)
			.expect('Content-Type', /json/)
			.expect(bodyHasFriendshipProperty)
			.expect((res) => res.body.friendship.status === 'friends')
			.expect(201, done);
	});

	describe('body has err property', () => {
		test('if JWT is not valid or not supplied', (done) => {
			request(app)
				.put(`/friendships/${user1AndUser3FriendshipId}`)
				.set('Accept', 'application/json')
				.expect('Content-Type', /json/)
				.expect(bodyHasErrProperty)
				.expect(401, done);
		});

		test('if friendshipId route parameter is not valid', (done) => {
			request(app)
				.put(`/friendships/${user1AndUser3FriendshipId}` + '123')
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user3Jwt}`)
				.expect('Content-Type', /json/)
				.expect(bodyHasErrProperty)
				.expect(404, done);
		});

		test('if friendship does not exists', (done) => {
			request(app)
				.put(
					`/friendships/${user1AndUser3FriendshipId.substring(
						0,
						user1AndUser3FriendshipId.length - 3
					)}` + '123'
				)
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user3Jwt}`)
				.expect('Content-Type', /json/)
				.expect(bodyHasErrProperty)
				.expect(404, done);
		});

		test('if requestee is not the currentUser', (done) => {
			request(app)
				.put(`/friendships/${user1AndUser3FriendshipId}`)
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user2Jwt}`)
				.expect('Content-Type', /json/)
				.expect(bodyHasErrProperty)
				.expect(403, done);
		});

		test('if friend request is already accepted', async (done) => {
			await request(app)
				.put(`/friendships/${user1AndUser3FriendshipId}`)
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user3Jwt}`)
				.expect('Content-Type', /json/)
				.expect(bodyHasFriendshipProperty)
				.expect((res) => res.body.friendship.status === 'friends')
				.expect(201);

			request(app)
				.put(`/friendships/${user1AndUser3FriendshipId}`)
				.set('Accept', 'application/json')
				.set('Authorization', `Bearer ${user3Jwt}`)
				.expect('Content-Type', /json/)
				.expect(bodyHasErrProperty)
				.expect(400, done);
		});
	});
});
