import {useContext, useState, useEffect} from "react";
import Link from "next/link";
import {List, Button, Image, Loader, Message} from "semantic-ui-react";
import axios from "axios";
import {UserContext} from "../../context/UserContext";

const Followers = ({username, followers, setFollowers, isProfileOwner, setOwnerFollowing}) => {
  const userContex = useContext(UserContext);
  const currentUser = userContex.currentUser;

  // Seguidores del usuario del perfil visitado
  const [loadingFollowers, setLoadingFollowers] = useState(true);

  // Usuarios seguidos por el usuario actualmente logueado
  const [currentUserFollowing, setCurrentUserFollowing] = useState([]);
  
  const [error, setError] = useState(null);
  const [processingFollow, setProcessingFollow] = useState(false);

  // Chequear si el usuario logueado está siguiendo a los usuarios
  // de la lista de followers del perfil visitado
  const checkIfFollowing = (userId) => {
    const check = currentUserFollowing.find(el => el.user._id.toString() === userId.toString());
    return !!check;
  }

  /*-----------------------------------------------------------*/
  // Consultar los seguidos del usuario actualmente autenticado
  /*-----------------------------------------------------------*/
  useEffect(() => {
    if(currentUser.username) {
      axios({
        method: "GET",
        url: `/api/profile/following/${currentUser.username}`
      })
      .then(res => {
        const {following} = res.data.data;
        setCurrentUserFollowing(following);
      })
      .catch(err => {
        let message = err.message;
        if(err.response) {
          message = err.response.data.message;
        }
        console.log(message);
      })
    }

  }, [currentUser.username]);

  
  /*---------------------------------------------------------*/
  // Consultar los seguidores del usuario del perfil visitado
  /*---------------------------------------------------------*/
  useEffect(() => {
    setLoadingFollowers(true);
    setError(null);

    axios({
      method: "GET",
      url: `/api/profile/followers/${username}` 
    })
    .then(res => {
      const {followers} = res.data.data;
      setFollowers(followers);
      setLoadingFollowers(false);
    })
    .catch(err => {
      let message = err.message;
      if(err.response) {
        message = err.response.data.message;
      }
      setError(message);
      setLoadingFollowers(false);
    })

  }, [username]);


  /*--------------------*/
  // Dar follow/unfollow
  /*--------------------*/
  const followHandler = async (username) => {
    try {
      setError(null);
      setProcessingFollow(username);

      const res = await axios({
        method: "GET",
        url: `/api/profile/follow/${username}`
      });

      const {actionType, siguiendo, _id} = res.data.data;

      setCurrentUserFollowing(prev => {
        // En caso de follow, agregar el usuario siguiendo a los followings del usuario actual
        if(actionType === "follow") {
          return [...prev, {_id, user: {_id: siguiendo}}];
        }

        // En caso de unfollow, remover el usuario siguiendo de los followings del usuario actual
        if(actionType === "unfollow") {
          const filtered = [...prev].filter(el => el.user._id.toString() !== siguiendo.toString());
          return filtered;
        }
      });

      // Actualizar el contador de los siguiendo en el perfil del usuario autenticado
      if(isProfileOwner) {
        setOwnerFollowing(prev => {
          if(actionType === "follow"){
            return [...prev, {_id, user: siguiendo}]
          }

          if(actionType === "unfollow") {
            return [...prev].filter(el => el.user.toString() !== siguiendo.toString())
          }
        })
      }

      setProcessingFollow(null);
      
    } catch (error) {
      let message = error.message;
      if(error.response) {
        message = error.response.data.message
      }
      setError(message);
      setProcessingFollow(null);
    }
  }


  // Mostrar loader mientras cargan los seguidores
  if(loadingFollowers) {
    return <Loader active inline="centered" />
  }

  // Mostrar mensaje si no tiene seguidores
  if(!loadingFollowers && followers.length === 0) {
    return (
      <Message
        icon="warning"
        header={isProfileOwner ? "You don't have followers yet" : "This user has no followers yet"}
      />
    )
  }


  return (
    <List divided verticalAlign="middle">
      {followers.map(el => {
        const {_id, name, username, avatar, status} = el.user;
        return (
          <List.Item
            key={el._id}
            style={{paddingTop: "10px", paddingBottom: "10px"}}
          >
            {/* Avatar del usuario */}
            <Image src={avatar} avatar />

            {/* Nombre y username del usuario */}
            <List.Content>
              {status === "active" ?
                <Link href={`/user/${username}`} passHref>
                  <List.Header>
                    {name}
                  </List.Header>
                </Link>
                :
                <List.Header as="span">
                  {name}
                </List.Header>
              }
              
              <List.Description>
                {status === "active" ? `@${username}` : ""}
              </List.Description>
            </List.Content>

            {/* Mostrar botón de follow/unfollow si no es el usuario actual */}
            {currentUser.username !== username &&
              <List.Content floated="right">
                <Button
                  color={checkIfFollowing(_id) ? "instagram" : "twitter"}
                  content={checkIfFollowing(_id) ? "Unfollow" : "Follow"}
                  icon={checkIfFollowing(_id) ? "check" : "add user"}
                  disabled={loadingFollowers || !!processingFollow || status !== "active"}
                  loading={loadingFollowers || processingFollow === username}
                  onClick={() => status === "active" ? followHandler(username) : null}
                />
              </List.Content>
            }
          </List.Item>
        )
      })}
    </List>
  )
}

export default Followers;