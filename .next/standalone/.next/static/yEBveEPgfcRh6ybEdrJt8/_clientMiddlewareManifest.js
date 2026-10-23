self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!api\\/auth|_next\\/static|_next\\/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|apple-icon.png|manifest.webmanifest|icons\\/|sanvicasa-logo.png).*))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/((?!api/auth|_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|apple-icon.png|manifest.webmanifest|icons/|sanvicasa-logo.png).*)"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()