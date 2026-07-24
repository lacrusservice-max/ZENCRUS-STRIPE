import { Router } from 'express'
import {
  getFeed, createPost, deletePost, likePost, unlikePost,
  getComments, addComment, followUser, unfollowUser,
  createPostSchema, addCommentSchema,
} from '../controllers/communityController'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

router.use(authenticate)

router.get('/feed', getFeed)
router.post('/posts', validate(createPostSchema), createPost)
router.delete('/posts/:id', deletePost)

router.post('/posts/:id/like', likePost)
router.delete('/posts/:id/like', unlikePost)

router.get('/posts/:id/comments', getComments)
router.post('/posts/:id/comments', validate(addCommentSchema), addComment)

router.post('/users/:id/follow', followUser)
router.delete('/users/:id/follow', unfollowUser)

export default router
