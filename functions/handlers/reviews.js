const { db } = require("../util/admin");

exports.postReview = (req, res) => {
	if (req.body.body.trim() === "") {
		return res.status(400).json({ review: "Must not be empty" });
	}

	const newReview = {
		bookId: req.params.bookId,
		body: req.body.body,
		userHandle: req.user.handle,
		userImage: req.user.imageUrl,
		createdAt: new Date().toISOString(),
		likeCount: 0,
	};

	db.doc(`/books/${req.params.bookId}`)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				return res.status(404).json({ error: "Book not Found" });
			}
			return db.collection("reviews").add(newReview);
		})
		.then(() => {
			res.json(newReview);
		})
		.catch((err) => {
			console.log(err);
			res.status(500).json({ error: "Something went wrong" });
		});
};

exports.likeReview = (req, res) => {
	const likeDocument = db
		.collection("reviewLikes")
		.where("userHandle", "==", req.user.handle)
		.where("reviewId", "==", req.params.reviewId)
		.limit(1);
	const reviewDocument = db.doc(`/reviews/${req.params.reviewId}`);

	let reviewData;

	reviewDocument
		.get()
		.then((doc) => {
			if (doc.exists) {
				reviewData = doc.data();
				reviewData.reviewId = doc.id;
				return likeDocument.get();
			} else {
				return res.status(404).json({ error: "Review Not found" });
			}
		})
		.then((data) => {
			if (data.empty) {
				return db
					.collection("reviewLikes")
					.add({
						reviewId: req.params.reviewId,
						userHandle: req.user.handle,
					})
					.then(() => {
						reviewData.likeCount++;
						return reviewDocument.update({ likeCount: reviewData.likeCount });
					})
					.then(() => {
						return res.json(reviewData);
					});
			} else {
				return res.status(400).json({ error: "Scream already liked" });
			}
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

exports.unlikeReview = (req, res) => {
	const likeDocument = db
		.collection("reviewLikes")
		.where("userHandle", "==", req.user.handle)
		.where("reviewId", "==", req.params.reviewId)
		.limit(1);
	const reviewDocument = db.doc(`/reviews/${req.params.reviewId}`);

	let reviewData;

	reviewDocument
		.get()
		.then((doc) => {
			if (doc.exists) {
				reviewData = doc.data();
				reviewData.reviewId = doc.id;
				return likeDocument.get();
			} else {
				return res.status(404).json({ error: "Review Not found" });
			}
		})
		.then((data) => {
			if (data.empty) {
				return res.status(400).json({ error: "Scream already liked" });
			} else {
				return db
					.doc(`/reviewLikes/${data.docs[0].id}`)
					.delete()
					.then(() => {
						reviewData.likeCount--;
						return reviewDocument.update({ likeCount: reviewData.likeCount });
					})
					.then(() => {
						res.json(reviewData);
					});
			}
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

exports.deleteReview = (req, res) => {
	const reviewDocument = db.doc(`/reviews/${req.params.reviewId}`);

	reviewDocument
		.get()
		.then((doc) => {
			if (!doc.exists) {
				return res.status(404).json({ error: "Review Not Found" });
			}
			if (doc.data().userHandle !== req.user.handle) {
				return res.status(403).json({ error: "Unauthorized" });
			} else {
				return reviewDocument.delete();
			}
		})
		.then(() => {
			res.json({ message: "Review deleted Successfully" });
		});
};
