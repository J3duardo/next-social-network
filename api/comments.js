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
    const commentsCount = await Comment.countDocuments({commentedPost: postId});

    // Consultar los comentarios
    const comments = await Comment
    .find({commentedPost: postId})
    .sort({createdAt: -1})
    .limit(amount)
    .skip(amount * (page - 1))
    .lean()
    .populate({
      path: "author",
      select: "_id name username email avatar role"
    });

    // Verificar si es la última página de documentos
    let isLastPage = comments.length < amount;

    res.json({
      status: "success",
      data: {
        commentsCount,
        comments,
        isLastPage
      }
    });
    
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
    let post = await Post.findById(postId).lean()
    if(!post) {
      return res.status(404).json({
        status: "failed",
        data: "Post not found or deleted"
      })
    }

    // Verificar si el usuario que comenta está bloqueado por el autor del post
    const commentAuthor = await User.findById(req.userId).select("blockedBy").lean();
    const commentAuthorBlockedBy = commentAuthor.blockedBy.map(el => el.toString());

    if(commentAuthorBlockedBy.includes(post.user.toString())) {
      return res.status(401).json({
        status: "failed",
        data: "You're not allowed to comment on this post"
      })
    }

    // Verificar si ya el usuario está suscrito al post
    const currentUsersSubscribed = post.followedBy.map(user => user.toString());
    const isSubscribed = currentUsersSubscribed.includes(req.userId.toString());

    // Agregar el autor del comentario a los seguidores del post
    // y agregar la id del post al array de suscripciones del usuario
    // si no es el autor del post y si no está suscrito
    if(req.userId !== post.user.toString() && !isSubscribed) {
      await Post.findOneAndUpdate(
        {_id: postId},
        {$push: {followedBy: req.userId}},
        {new: true}
      );

      await User.findOneAndUpdate(
        {_id: req.userId},
        {$push: {postsSubscribed: postId.toString()}
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

    // Crear la notificación de nuevo comentario (sólo si no es el autor del post)
    if(post.user.toString() !== req.userId.toString()) {
      await newCommentNotification(post._id, newComment._id, text, req.userId, post.user)
    }

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
    const comment = await Comment
    .findById(commentId)
    .populate({
      path: "commentedPost",
      select: "user"
    });

    if(!comment) {
      return res.status(404).json({
        status: "failed",
        message: "Comment not found or deleted"
      })
    }

    // Verificar si el comentario pertenece al usuario que lo intenta eliminar
    // o si es el autor del post o si el usuario es admin
    if(req.userRole !== "admin" && comment.author.toString() !== req.userId.toString() && comment.commentedPost.user.toString() !== req.userId.toString()) {
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
  try {
    const {text} = req.body;

    // Validar texto del comentario
    if(!text || text.length === 0) {
      return res.status(400).json({
        status: "failed",
        message: "Comments cannot be empty"
      })
    }

    // Buscar el comentario y actualizar el historial de cambios
    const prevComment = await Comment
    .findById(req.params.commentId)
    .lean()
    .select("user author text updatedAt");

    // Verificar si el usuario es admin o el autor del comentario
    if(req.userRole !== "admin" && (req.userId.toString() !== prevComment.author.toString())) {
      return res.status(403).json({
        status: "failed",
        message: "You're not allowed to perform this task"
      })
    }

    // Editar el comentario y verificar si existe
    const editedComment = await Comment
    .findOneAndUpdate(
      {_id: req.params.commentId},
      {text, $push: {editHistory: {text: prevComment.text, date: prevComment.updatedAt}}},
      {new: true}
    )
    .populate({
      path: "author",
      select: "_id name username email avatar role"
    });

    if(!editedComment) {
      return res.status(404).json({
        status: "failed",
        message: "Comment not found or deleted"
      })
    }

    res.json({
      status: "success",
      data: editedComment
    })
    
  } catch (error) {
    console.log(`Error editing comment: ${error.message}`);
    res.status(500).json({
      status: "failed",
      message: `Error editing comment: ${error.message}`
    })
  }
});

module.exports = router;