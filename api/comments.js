const router = require("express").Router();
const Comment = require("../models/CommentModel");
const Post = require("../models/PostModel");
const User = require("../models/UserModel");
const authMiddleware = require("../middleware/authMiddleware");
const {newCommentNotification, removeNotification} = require("../utilsServer/notificationActions");

// Consultar los comentarios de un post
router.get("/:postId", authMiddleware, async (req, res) => {
  try {
    const {postId} = req.params;
    const page = +req.query.page;
    const amount = 5;

    // Verificar si el post existe
    const postExists = await Post.exists({_id: postId});
    if(!postExists) {
      return res.status(404).json({
        status: "failed",
        message: "Post not found or deleted"
      })
    }

    // Consultar el número de comentarios totales del post
    const commentsCount = await Comment.countDocuments({commentedPost: postId})

    // Consultar los comentarios
    const comments = await Comment
    .find({commentedPost: postId})
    .limit(amount)
    .skip(amount * (page - 1))
    .lean()
    .populate({
      path: "author",
      select: "_id name username email avatar role"
    });

    res.json({
      status: "success",
      data: {commentsCount, comments}
    })
    
  } catch (error) {
    console.log(`Error fetching post comments: ${error.message}`);
    res.status(500).json({
      status: "failed",
      message: `Error fetching post comments: ${error.message}`
    })
  }
})

// Crear un comentario asociado a un post
router.post("/:postId", authMiddleware, async (req, res) => {
  try {
    const {text} = req.body;
    const {postId} = req.params;

    // Validar el contenido del comentario
    if(!text || text.length === 0) {
      return res.status(400).json({
        status: "failed",
        message: "The comment cannot be empty"
      })
    }
    
    // Verificar si el post existe
    const post = await Post.findById(postId);
    if(!post) {
      return res.status(404).json({
        status: "failed",
        data: "Post not found or deleted"
      })
    }

    // Consultar el usuario autor del post
    const author = await User
    .findById(req.userId)
    .lean()

    // Crear el nuevo comentario y guardarlo en la DB
    const newComment = new Comment({
      user: post.user,
      author: author._id,
      text,
      commentedPost: post._id
    });

    await newComment.save();

    // Crear la notificación de nuevo comentario
    await newCommentNotification(post._id, newComment._id, text, req.userId, post.user);

    res.json({
      status: "success",
      data: {
        _id: newComment._id,
        user: newComment.user,
        text: newComment.text,
        commentedPost: newComment.post,
        author: {
          _id: author._id,
          name: author.name,
          username: author.username,
          email: author.email,
          avatar: author.avatar,
          role: author.role
        },
        createdAt: newComment.createdAt,
        updatedAt: newComment.updatedAt
      }
    })
    
  } catch (error) {
    console.log(`Error creating comment: ${error.message}`);
    res.status(500).json({
      status: "failed",
      message: `Error creating comment: ${error.message}`
    })
  }
});

// Eliminar un comentario
router.delete("/:commentId", authMiddleware, async (req, res) => {
  try {
    // Buscar el comentario a eliminar y verificar si existe
    const {commentId} = req.params;
    const comment = await Comment.findById(commentId);

    if(!comment) {
      return res.status(404).json({
        status: "failed",
        message: "Comment not found or deleted"
      })
    }

    // Verificar si el comentario pertenece al usuario que lo intenta eliminar o si el usuario es admin
    if(req.userRole !== "admin" || (comment.author.toString() !== req.userId.toString())) {
      return res.status(403).json({
        status: "failed",
        message: "You're not allowed to perform this task"
      })
    }

    // Si existe y pertenece al usuario, eliminarlo
    await comment.delete();

    // Eliminar la notificación asociada al comentario
    await removeNotification("comment", null, null, commentId);

    res.json({
      status: "success",
      data: comment
    })
    
  } catch (error) {
    console.log(`Error deleting comment: ${error.message}`);
    res.status(500).json({
      status: "failed",
      message: `Error deleting comment: ${error.message}`
    })
  }
});

// Editar un comentario
router.patch("/:commentId", authMiddleware, async (req, res) => {
  return null
});

module.exports = router;