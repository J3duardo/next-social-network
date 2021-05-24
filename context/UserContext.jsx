import {createContext, useState} from "react";
import Router from "next/router";
import jsCookie from "js-cookie";

export const UserContext = createContext({
  isAuth: false,
  currentUser: null,
  currentProfile: null,
  setCurrentUser: () => {},
  setCurrentProfile: () => {},
  logOut: () => {}
});

const UserContextProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuth, setIsAuth] = useState(false);

  const setCurrentUser = (user) => {
    console.log({user});
    setUser(user);
    setIsAuth(true);
    localStorage.setItem("user", JSON.stringify(user));
  }

  const setCurrentProfile = (profile) => {
    console.log({profile});
    setProfile(profile);
    localStorage.setItem("profile", JSON.stringify(profile));
  }

  const logOut = () => {
    setUser(null);
    setProfile(null);
    setIsAuth(false);
    jsCookie.remove("token");

    localStorage.removeItem("user");
    localStorage.removeItem("profile");

    Router.push("/login");
  }

  return (
    <UserContext.Provider
      value ={{
        isAuth,
        currentUser: user,
        currentProfile: profile,
        setCurrentUser,
        setCurrentProfile,
        logOut
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export default UserContextProvider;