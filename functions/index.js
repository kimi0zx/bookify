const functions = require("firebase-functions");

const app = require("express")();

const cors = require("cors");
app.use(cors());

const {
	getAllBooks,
	postOneBook,
	postBookImage,
	searchBook,
	searchCategory,
	getBook,
	rateBook,
} = require("./handlers/books");
const {
	signup,
	login,
	uploadImage,
	addUserDetails,
	getAuthenticatedUser,
} = require("./handlers/users");
const {
	postReview,
	likeReview,
	unlikeReview,
	deleteReview,
} = require("./handlers/reviews");
const FBAuth = require("./util/fbAuth");
const { db } = require("./util/admin");

//Book Routes
app.get("/books", getAllBooks);
app.post("/book", FBAuth, postOneBook);
app.get("/books/:bookId", getBook);
app.post("/book/image", FBAuth, postBookImage);
app.post("/books/search", searchBook);
app.post("/books/category", searchCategory);
app.post("/book/:bookId/rate", FBAuth, rateBook);

//User Routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);

//Review Routes
app.post("/book/:bookId/review", FBAuth, postReview);
app.get("/reviews/:reviewId/like", FBAuth, likeReview);
app.get("/reviews/:reviewId/unlike", FBAuth, unlikeReview);
app.delete("/reviews/:reviewId", FBAuth, deleteReview);

exports.api = functions.region("asia-south1").https.onRequest(app);

exports.onUserImageChange = functions
	.region("asia-south1")
	.firestore.document("/users/{userId}")
	.onUpdate((change) => {
		if (change.before.data().imageUrl !== change.after.data().imageUrl) {
			const batch = db.batch();
			return db
				.collection("reviews")
				.where("userHandle", "==", change.before.data().handle)
				.get()
				.then((data) => {
					data.forEach((doc) => {
						const review = db.doc(`/reviews/${doc.id}`);
						batch.update(review, { userImage: change.after.data().imageUrl });
					});
					return batch.commit();
				});
		} else return true;
	});

exports.onReviewDelete = functions
	.region("asia-south1")
	.firestore.document("/reviews/{reviewId}")
	.onDelete((snapshot, context) => {
		const reviewId = context.params.reviewId;
		const batch = db.batch();
		return db
			.collection("reviewLikes")
			.where("reviewId", "==", reviewId)
			.get()
			.then((data) => {
				data.forEach((doc) => {
					batch.delete(db.doc(`/reviewLikes/${doc.id}`));
				});
				return batch.commit();
			})
			.catch((err) => console.error(err));
	});
