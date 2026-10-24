/* ★ NHẬP DỮ LIỆU khi chuyển từ bản chạy file:// sang http://localhost.
   localStorage gắn theo origin nên đổi địa chỉ là mất tài khoản + tiến độ.
   Trang file:// đã POST dữ liệu lên /__import và chuyển sang ?import=<token>.
   Đoạn này chạy ĐỒNG BỘ trước mọi script khác để app đọc đúng dữ liệu ngay. */
(function(){
  try{
    var m=/[?&]import=([^&]+)/.exec(location.search);
    if(!m) return;
    var token=decodeURIComponent(m[1]);
    var xhr=new XMLHttpRequest();
    xhr.open('GET','/__import?token='+encodeURIComponent(token),false);
    xhr.send(null);
    if(xhr.status===200){
      var d={};try{d=JSON.parse(xhr.responseText||'{}')}catch(e){d={}}
      var data=(d&&d.data)||{};
      for(var k in data){
        if(Object.prototype.hasOwnProperty.call(data,k)){
          try{localStorage.setItem(k,String(data[k]))}catch(e){}
        }
      }
    }
    try{history.replaceState(null,'',location.pathname)}catch(e){}
  }catch(e){}
})();
