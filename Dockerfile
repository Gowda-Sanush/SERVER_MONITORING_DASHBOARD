FROM nginx:alpine
COPY frontend /usr/share/nginx/html
COPY data /usr/share/nginx/html/data
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]