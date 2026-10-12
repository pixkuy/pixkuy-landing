(function(window){
  'use strict';
  // Existing public contact destination, independent of Netlify initialization.
  function phone(){return ['52','1','55','2883','7400'].join('');}
  function url(){return 'https://wa.me/'+phone();}
  window.PixkuyWhatsappContact={phone:phone,url:url};
})(window);
