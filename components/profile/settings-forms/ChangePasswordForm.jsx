import {useEffect, useState, useContext} from "react";
import {Form, Header, Icon, Button, Message} from "semantic-ui-react";
import axios from "axios";
import ValidationErrorMessage from "../../common/ValidationErrorMessage";
import {UserContext} from "../../../context/UserContext";

const ChangePasswordForm = () => {
  const userContext = useContext(UserContext);

  // State de los valores de los inputs
  const [passwordValues, setPasswordValues] = useState({
    currentPassword: "",
    newPassword: "",
    passwordConfirm: ""
  });

  // State de los errores de validación del formulario
  const [validationErrors, setValidationErrors] = useState({
    currentPassword: null,
    newPassword: null,
    passwordConfirm: null
  });

  // State de los campos visitados
  const [isFieldVisited, setIsFieldVisited] = useState({
    currentPassword: false,
    newPassword: false,
    passwordConfirm: false
  })

  // State del submit del formulario
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [backendErrorMsg, setBackendErrorMsg] = useState(null);

  /*----------------------------------*/
  // Validar los campos del formulario
  /*----------------------------------*/
  const formValidator = (fields = passwordValues) => {
    setValidationErrors({
      currentPassword: null,
      newPassword: null,
      passwordConfirm: null
    });

    const errors = {};
    let isFormValid = true;

    if(fields.currentPassword.length < 6 || fields.currentPassword.length > 30) {
      errors.currentPassword = "The password must be at least 6 characters and max 30 characters"
    }

    if(fields.currentPassword.length === 0) {
      errors.currentPassword = "The current password is required"
    }

    if(fields.newPassword.length < 6 || fields.newPassword.length > 30) {
      errors.newPassword = "The password must be at least 6 characters and max 30 characters"
    }

    if(fields.newPassword.length === 0) {
      errors.newPassword = "The new password is required"
    }

    if(fields.passwordConfirm.length === 0) {
      errors.passwordConfirm = "You must confirm your password"
    }

    // Chequear si las contraseñas coinciden
    if((fields.passwordConfirm.length > 0 && fields.newPassword.length > 0) && fields.passwordConfirm !== fields.newPassword) {
      errors.passwordConfirm = "Passwords don't match";
    }

    if(Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      isFormValid = false;

    } else {
      setValidationErrors({
        currentPassword: null,
        newPassword: null,
        passwordConfirm: null
      });
      isFormValid = true;
    }

    return isFormValid;
  }

  /*-----------------------------------------------*/
  // Procesar el formulario de cambio de contraseña
  /*-----------------------------------------------*/
  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setBackendErrorMsg(null);

    // Validar el formulario al intentar enviarlo
    const isValid = formValidator();
    setIsFieldVisited({
      currentPassword: true,
      newPassword: true,
      passwordConfirm: true
    });

    // Impedir enviar la data si no pasa la validación
    if(!isValid) {
      setLoading(false);
      return false;
    }

    try {
      const res = await axios({
        method: "PATCH",
        url: "/api/profile/me/update-password",
        data: {
          currentPassword: passwordValues.currentPassword,
          newPassword: passwordValues.newPassword
        },
        headers: {
          "Content-Type": "application/json"
        }
      });

      console.log({response: res.data.data});
      setSuccessMsg(res.data.data.message);
      setLoading(false);

      setTimeout(() => {
        userContext.logOut();
      }, 3500);
      
    } catch (error) {
      let msg = error.message;

      if(error.response) {
        msg = error.response.data.message;
      }

      setBackendErrorMsg(msg);
      setLoading(false);
    }
  }

  /*---------------*/
  // Evento change
  /*---------------*/
  const onChangeHandler = (e) => {
    const trimmedValue = e.target.value.trim();
    const fieldName = e.target.name;

    setSuccessMsg(null);
    setBackendErrorMsg(null);

    setPasswordValues(prev => {
      // Validar el input mientras se tipea
      formValidator({...prev, [fieldName]: trimmedValue})

      return {
        ...prev,
        [fieldName]: trimmedValue
      }
    })
  }

  /*------------*/
  // Evento blur
  /*------------*/
  const onBlurHandler = (e) => {
    setIsFieldVisited(prev => {
      return {...prev, [e.target.name]: true}
    })
  }


  return (
    <>
      <Header as="h4" textAlign="center">
        <Icon name="user secret" />
        Change password
      </Header>

      <Form
        noValidate
        loading={loading}
        error={!!backendErrorMsg}
        success={!!successMsg}
        onSubmit={onSubmitHandler}
      >
        <Message
          error
          header="Oops!"
          content={backendErrorMsg}
          onDismiss={() => setBackendErrorMsg(null)}
        />
        
        <Message
          success
          header="Success!"
          content={successMsg}
          onDismiss={() => setSuccessMsg(null)}
        />

        <Form.Input
          label="Current password"
          type="password"
          name="currentPassword"
          placeholder="Your current password"
          error={
            validationErrors.currentPassword &&
            isFieldVisited.currentPassword ||
            backendErrorMsg && backendErrorMsg.toLowerCase() === "wrong password"
          }
          value={passwordValues.currentPassword}
          onChange={onChangeHandler}
          onBlur={onBlurHandler}
        />
        {validationErrors.currentPassword && isFieldVisited.currentPassword &&
          <ValidationErrorMessage message={validationErrors.currentPassword} />
        }

        <Form.Input
          id="newPassword"
          type="password"
          label="New password"
          name="newPassword"
          placeholder="Your new password"
          error={validationErrors.newPassword && isFieldVisited.newPassword}
          value={passwordValues.newPassword}
          onChange={onChangeHandler}
          onBlur={onBlurHandler}
        />
        {validationErrors.newPassword && isFieldVisited.newPassword &&
          <ValidationErrorMessage message={validationErrors.newPassword} />
        }

        <Form.Input
          id="passwordConfirm"
          type="password"
          label="Confirm password"
          name="passwordConfirm"
          placeholder="Confirm the new password"
          error={validationErrors.passwordConfirm && isFieldVisited.passwordConfirm}
          value={passwordValues.passwordConfirm}
          onChange={onChangeHandler}
          onBlur={onBlurHandler}
        />
        {validationErrors.passwordConfirm && isFieldVisited.passwordConfirm &&
          <ValidationErrorMessage message={validationErrors.passwordConfirm} />
        }

        <Button primary content="Confirm" />
      </Form>
    </>
  )
}

export default ChangePasswordForm;
