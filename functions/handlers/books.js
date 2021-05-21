const { admin, db } = require("../util/admin");
const config = require("../util/config");

const pushBooks = (data, res) => {
	let books = [];
	data.forEach((doc) => {
		books.push({
			...doc.data(),
		});
	});
	return res.json(books);
};

exports.getAllBooks = (req, res) => {
	db.collection("books")
		.orderBy("title")
		.get()
		.then((data) => {
			pushBooks(data, res);
		})
		.catch((err) => console.error(err));
};

exports.postOneBook = (req, res) => {
	const newBook = {
		title: req.body.title,
		isbnNumber: req.body.isbnNumber,
		rating: "No ratings yet",
		// author: req.body.author,
		// description: req.body.description,
		// language: req.body.language,
		// link: req.body.link,
		// year: req.body.year,
		// genre: req.body.genre,
	};

	return db
		.doc(`/books/${newBook.isbnNumber}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				return res.status(400).json({ handle: "Book already exists" });
			} else {
				return db
					.doc(`/books/${newBook.isbnNumber}`)
					.set(newBook)
					.then((data) => {
						res.json({
							message: `Book ${newBook.isbnNumber} created successfully`,
						});
					})
					.catch((err) => {
						res.status(500).json({ error: "Something went wrong" });
						console.log(err);
					});
			}
		});
};

exports.postBookImage = (req, res) => {
	const BusBoy = require("busboy");
	const path = require("path");
	const os = require("os");
	const fs = require("fs");

	const isbnNumber = req.headers.bookId;
	const busboy = new BusBoy({ headers: req.headers });

	let imageFileName;
	let imageToBeUploaded;

	busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
		if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
			return res.status(400).json({ error: "Wrong file type submitted" });
		}
		const imageExtension = filename.split(".")[filename.split(".").length - 1];
		imageFileName = `${Math.round(
			Math.random() * 1000000000
		)}.${imageExtension}`;
		const filepath = path.join(os.tmpdir(), imageFileName);
		imageToBeUploaded = { filepath, mimetype };
		file.pipe(fs.createWriteStream(filepath));
	});
	busboy.on("finish", () => {
		admin
			.storage()
			.bucket()
			.upload(imageToBeUploaded.filepath, {
				resumable: false,
				metadata: {
					metadata: {
						contentType: imageToBeUploaded.mimetype,
					},
				},
			})
			.then(() => {
				const coverImage = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
				return db.doc(`/books/${isbnNumber}`).update({ coverImage });
			})
			.then(() => {
				return res.json({ message: "Image uploaded successfully" });
			})
			.catch((err) => {
				console.error(err);
				return res.status(500).json({ error: err.code });
			});
	});
	busboy.end(req.rawBody);
};

exports.searchBook = (req, res) => {
	let searchTerm = req.body.searchTerm;

	db.collection("books")
		.where("title", ">=", searchTerm)
		.where("title", "<=", searchTerm + "\uf8ff")
		.get()
		.then((data) => {
			pushBooks(data, res);
		})
		.catch((err) => console.error(err));
};

exports.searchCategory = (req, res) => {
	let fullTerm = req.body.fullTerm;
	let categoryTerm = fullTerm.split(":")[0];
	let searchTerm = fullTerm.split(":")[1];

	if (categoryTerm === "genre") {
		db.collection("books")
			.where(categoryTerm, "array-contains", searchTerm)
			.get()
			.then((data) => {
				pushBooks(data, res);
			})
			.catch((err) => console.error(err));
	} else {
		db.collection("books")
			.where(categoryTerm, "==", searchTerm)
			.get()
			.then((data) => {
				pushBooks(data, res);
			})
			.catch((err) => console.error(err));
	}
};

exports.getBook = (req, res) => {
	let bookData = {};
	db.doc(`/books/${req.params.bookId}`)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				return res.status(404).json({ error: "Book not Found" });
			}
			bookData = doc.data();
			return db
				.collection("reviews")
				.orderBy("createdAt", "desc")
				.where("bookId", "==", req.params.bookId)
				.get();
		})
		.then((data) => {
			bookData.reviews = [];
			data.forEach((doc) => {
				let reviewId = doc.id;
				bookData.reviews.push({ reviewId, ...doc.data() });
			});
			return res.json(bookData);
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

exports.rateBook = (req, res) => {
	const rateDocument = db
		.collection("ratings")
		.where("userHandle", "==", req.user.handle)
		.where("bookId", "==", req.params.bookId)
		.limit(1);
	const bookDocument = db.doc(`/books/${req.params.bookId}`);

	let rating = req.body.rating;
	if (!(rating >= 0 && rating <= 10)) {
		return res
			.status(400)
			.json({ rating: "Please give a rating between 0 to 10" });
	}
	let bookData;

	bookDocument
		.get()
		.then((doc) => {
			if (doc.exists) {
				bookData = doc.data();
				return rateDocument.get();
			} else {
				return res.status(404).json({ error: "Book Not found" });
			}
		})
		.then((data) => {
			if (data.empty) {
				return db
					.collection("ratings")
					.add({
						bookId: req.params.bookId,
						userHandle: req.user.handle,
						rating,
					})
					.then(() => {
						let ratingsSum = bookData.ratings * bookData.rateCount;
						bookData.rateCount++;
						let newAvg = (ratingsSum + rating) / bookData.rateCount;
						bookData.ratings = newAvg;
						return bookDocument.update({
							rateCount: bookData.rateCount,
							ratings: bookData.ratings,
						});
					})
					.then(() => {
						return res.json(bookData);
					});
			} else {
				return res.status(400).json({ error: "Book Already rated" });
			}
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};
